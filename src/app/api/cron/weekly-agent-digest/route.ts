/**
 * GET /api/cron/weekly-agent-digest
 * ──────────────────────────────────────────────────────────────
 * Cron hebdomadaire, dimanche 18:00 UTC (~19h Paris hiver / 20h été).
 * Envoie à Mickael un résumé transverse des 4 agents pour la semaine
 * qui vient de s'écouler.
 *
 * Contenu du digest :
 * - Site : conversations tenues, leads qualifiés (notifiés), nouveaux
 *   contacts CRM issus du chatbot.
 * - WhatsApp/Assistant : événements créés, sessions actives.
 * - Marketing : posts publiés (IG + LinkedIn copiés + blog brouillons).
 * - Admin : devis émis, contrats envoyés, factures payées, retards,
 *   CA de la semaine.
 *
 * Sécurité : Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { query } from "@/lib/db";
import { logEvent } from "@/lib/agents";
import { notifyMickael } from "@/lib/whatsapp-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WeekStats = {
  site_conversations: number;
  site_leads: number;
  site_promoted_contacts: number;
  whatsapp_events: number;
  whatsapp_sessions: number;
  marketing_ig_published: number;
  marketing_linkedin_copied: number;
  marketing_blog_drafts: number;
  admin_quotes_created: number;
  admin_contracts_sent: number;
  admin_invoices_paid: number;
  admin_ca_cents: number;
  admin_invoices_overdue: number;
  admin_overdue_amount_cents: number;
};

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const stats = await collectWeekStats();
    const text = formatDigest(stats);

    const result = await notifyMickael(text);
    await logEvent(
      "site",
      "weekly_digest_sent",
      { stats, provider: result.ok ? result.provider : null },
      result.ok
    );

    return NextResponse.json({
      ok: result.ok,
      sent: result.ok,
      provider: result.ok ? result.provider : undefined,
      error: !result.ok ? result.error : undefined,
      stats,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[cron/weekly-agent-digest]", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

// ─── Collecte des stats de la semaine (7 j) ──────────────────────
async function collectWeekStats(): Promise<WeekStats> {
  // Une seule requête agrégée par domaine, chacune tolérante aux
  // tables manquantes (retourne 0 si la table n'existe pas).
  const site = await safeQuery<{ conv: number; leads: number; promoted: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM chat_conversations
          WHERE created_at >= NOW() - INTERVAL '7 days') AS conv,
       (SELECT COUNT(*)::int FROM chat_conversations
          WHERE notified = TRUE AND notified_at >= NOW() - INTERVAL '7 days') AS leads,
       (SELECT COUNT(*)::int FROM agent_events
          WHERE event_type = 'lead_promoted_to_contact'
            AND created_at >= NOW() - INTERVAL '7 days') AS promoted`
  );

  const wa = await safeQuery<{ evts: number; sess: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM agent_events
          WHERE agent_slug = 'whatsapp'
            AND event_type IN ('create_event','create_event_with_meet','update_event','delete_event')
            AND created_at >= NOW() - INTERVAL '7 days') AS evts,
       (SELECT COUNT(*)::int FROM assistant_sessions
          WHERE updated_at >= NOW() - INTERVAL '7 days') AS sess`
  );

  const mkt = await safeQuery<{ ig: number; li: number; blog: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM marketing_briefs
          WHERE instagram_status = 'published'
            AND instagram_published_at >= NOW() - INTERVAL '7 days') AS ig,
       (SELECT COUNT(*)::int FROM marketing_briefs
          WHERE linkedin_status = 'copied'
            AND linkedin_copied_at >= NOW() - INTERVAL '7 days') AS li,
       (SELECT COUNT(*)::int FROM marketing_briefs
          WHERE blog_post_id IS NOT NULL
            AND updated_at >= NOW() - INTERVAL '7 days') AS blog`
  );

  const admin = await safeQuery<{
    quotes: number;
    contracts: number;
    paid: number;
    ca: string;
    overdue: number;
    overdue_amount: string;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM admin_documents
          WHERE doc_type = 'quote'
            AND created_at >= NOW() - INTERVAL '7 days') AS quotes,
       (SELECT COUNT(*)::int FROM admin_documents
          WHERE doc_type = 'contract' AND status = 'sent'
            AND sent_at >= NOW() - INTERVAL '7 days') AS contracts,
       (SELECT COUNT(*)::int FROM admin_documents
          WHERE doc_type = 'invoice' AND status = 'paid'
            AND paid_at >= NOW() - INTERVAL '7 days') AS paid,
       (SELECT COALESCE(SUM(total_cents), 0)::text FROM admin_documents
          WHERE doc_type = 'invoice' AND status = 'paid'
            AND paid_at >= NOW() - INTERVAL '7 days') AS ca,
       (SELECT COUNT(*)::int FROM admin_documents
          WHERE doc_type = 'invoice' AND status = 'sent'
            AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS overdue,
       (SELECT COALESCE(SUM(total_cents), 0)::text FROM admin_documents
          WHERE doc_type = 'invoice' AND status = 'sent'
            AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS overdue_amount`
  );

  return {
    site_conversations: site?.conv ?? 0,
    site_leads: site?.leads ?? 0,
    site_promoted_contacts: site?.promoted ?? 0,
    whatsapp_events: wa?.evts ?? 0,
    whatsapp_sessions: wa?.sess ?? 0,
    marketing_ig_published: mkt?.ig ?? 0,
    marketing_linkedin_copied: mkt?.li ?? 0,
    marketing_blog_drafts: mkt?.blog ?? 0,
    admin_quotes_created: admin?.quotes ?? 0,
    admin_contracts_sent: admin?.contracts ?? 0,
    admin_invoices_paid: admin?.paid ?? 0,
    admin_ca_cents: Number(admin?.ca ?? 0),
    admin_invoices_overdue: admin?.overdue ?? 0,
    admin_overdue_amount_cents: Number(admin?.overdue_amount ?? 0),
  };
}

async function safeQuery<T extends Record<string, unknown>>(sql: string): Promise<T | null> {
  try {
    const rows = await query<T>(sql);
    return rows[0] ?? null;
  } catch (e) {
    // Table manquante ou colonne renommée : on ne bloque pas le digest, mais
    // on rend l'échec VISIBLE via un event success=false (consultable sur
    // /admin/agents) — pour distinguer un vrai 0 d'une requête cassée.
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[digest/query]", message);
    try {
      await logEvent("site", "weekly_digest_query_failed", { message, sql }, false);
    } catch (logErr) {
      // Journalisation best-effort : ne jamais casser le digest.
      console.warn("[digest/query] logEvent échoué", logErr instanceof Error ? logErr.message : logErr);
    }
    return null;
  }
}

// ─── Formatage du message ─────────────────────────────────────
function formatDigest(s: WeekStats): string {
  const eur = (cents: number) =>
    (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 });

  const now = new Date();
  const label = now.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [
    `📊 Bilan de la semaine — clôture ${label}`,
    "",
  ];

  // ── Site (chatbot)
  lines.push("▸ Chatbot du site");
  if (s.site_conversations === 0) {
    lines.push("· Aucune conversation cette semaine.");
  } else {
    lines.push(
      `· ${s.site_conversations} conversation${s.site_conversations > 1 ? "s" : ""}, ${s.site_leads} lead${s.site_leads > 1 ? "s" : ""} qualifié${s.site_leads > 1 ? "s" : ""}`
    );
    if (s.site_promoted_contacts > 0) {
      lines.push(`· ${s.site_promoted_contacts} nouveau${s.site_promoted_contacts > 1 ? "x" : ""} contact${s.site_promoted_contacts > 1 ? "s" : ""} ajouté${s.site_promoted_contacts > 1 ? "s" : ""} au CRM`);
    }
  }
  lines.push("");

  // ── WhatsApp / assistant
  lines.push("▸ Assistant WhatsApp");
  if (s.whatsapp_events === 0 && s.whatsapp_sessions === 0) {
    lines.push("· Aucune activité cette semaine.");
  } else {
    if (s.whatsapp_events > 0)
      lines.push(`· ${s.whatsapp_events} action${s.whatsapp_events > 1 ? "s" : ""} sur l'agenda (créations / modifications)`);
    if (s.whatsapp_sessions > 0)
      lines.push(`· ${s.whatsapp_sessions} session${s.whatsapp_sessions > 1 ? "s" : ""} conversationnelle${s.whatsapp_sessions > 1 ? "s" : ""}`);
  }
  lines.push("");

  // ── Marketing
  lines.push("▸ Marketing");
  const total = s.marketing_ig_published + s.marketing_linkedin_copied + s.marketing_blog_drafts;
  if (total === 0) {
    lines.push("· Aucune publication cette semaine.");
  } else {
    if (s.marketing_ig_published > 0)
      lines.push(`· ${s.marketing_ig_published} post${s.marketing_ig_published > 1 ? "s" : ""} Instagram publié${s.marketing_ig_published > 1 ? "s" : ""}`);
    if (s.marketing_linkedin_copied > 0)
      lines.push(`· ${s.marketing_linkedin_copied} post${s.marketing_linkedin_copied > 1 ? "s" : ""} LinkedIn préparé${s.marketing_linkedin_copied > 1 ? "s" : ""}`);
    if (s.marketing_blog_drafts > 0)
      lines.push(`· ${s.marketing_blog_drafts} article${s.marketing_blog_drafts > 1 ? "s" : ""} blog en brouillon`);
  }
  lines.push("");

  // ── Admin financier
  lines.push("▸ Administratif & finances");
  if (s.admin_quotes_created > 0)
    lines.push(`· ${s.admin_quotes_created} devis émis`);
  if (s.admin_contracts_sent > 0)
    lines.push(`· ${s.admin_contracts_sent} contrat${s.admin_contracts_sent > 1 ? "s" : ""} envoyé${s.admin_contracts_sent > 1 ? "s" : ""} à signature`);
  if (s.admin_invoices_paid > 0)
    lines.push(`· ${s.admin_invoices_paid} facture${s.admin_invoices_paid > 1 ? "s" : ""} payée${s.admin_invoices_paid > 1 ? "s" : ""} — CA ${eur(s.admin_ca_cents)} €`);
  if (
    s.admin_quotes_created === 0 &&
    s.admin_contracts_sent === 0 &&
    s.admin_invoices_paid === 0
  ) {
    lines.push("· Aucun mouvement documentaire cette semaine.");
  }
  if (s.admin_invoices_overdue > 0) {
    lines.push(
      `⚠ ${s.admin_invoices_overdue} facture${s.admin_invoices_overdue > 1 ? "s" : ""} en retard — ${eur(s.admin_overdue_amount_cents)} € en attente`
    );
  }

  lines.push("");
  lines.push("Détail complet : /admin/agents");

  return lines.join("\n");
}
