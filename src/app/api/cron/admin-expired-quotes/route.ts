/**
 * GET /api/cron/admin-expired-quotes
 * ──────────────────────────────────────────────────────────────
 * Cron hebdomadaire, mercredi ~11 h Paris (10:00 UTC hiver, 09:00 UTC été).
 * Passe en revue les devis 'sent' émis il y a plus de 30 jours et
 * les fait basculer au statut 'expired'. Notifie Mickael avec la
 * liste pour qu'il puisse relancer.
 *
 * Sécurité : Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { query, execute } from "@/lib/db";
import { logEvent } from "@/lib/agents";
import { notifyMickael } from "@/lib/whatsapp-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExpiringQuote = {
  id: number;
  reference: string;
  client_name: string;
  total_cents: number;
  created_at: string;
  days_since_sent: number;
};

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // Devis 'sent' émis il y a plus de 30 jours → à passer en 'expired'.
    const toExpire = await query<ExpiringQuote>(
      `SELECT
         id, reference, client_name, total_cents, created_at::text,
         (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::int AS days_since_sent
       FROM admin_documents
       WHERE doc_type = 'quote'
         AND status = 'sent'
         AND created_at < NOW() - INTERVAL '30 days'
       ORDER BY created_at ASC
       LIMIT 50`
    );

    if (toExpire.length > 0) {
      const ids = toExpire.map((q) => q.id);
      await execute(
        `UPDATE admin_documents
         SET status = 'expired', updated_at = NOW()
         WHERE id = ANY($1::bigint[])`,
        [ids]
      );
    }

    // Devis qui vont bientôt expirer (22-30 j) — à relancer avant expiration.
    // Fenêtre de 8 j > période du cron (7 j) : ~1 j de marge pour absorber le
    // jitter d'exécution et la bascule DST (le run peut glisser de 1 h) sans
    // qu'un devis passe direct en 'expired' sans avoir été relancé.
    const toRelaunch = await query<ExpiringQuote>(
      `SELECT
         id, reference, client_name, total_cents, created_at::text,
         (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::int AS days_since_sent
       FROM admin_documents
       WHERE doc_type = 'quote'
         AND status = 'sent'
         AND created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '22 days'
       ORDER BY created_at ASC
       LIMIT 20`
    );

    if (toExpire.length === 0 && toRelaunch.length === 0) {
      await logEvent("admin", "expired_quotes_check", { expired: 0, to_relaunch: 0 });
      return NextResponse.json({ ok: true, expired: 0, to_relaunch: 0, sent: false });
    }

    const eur = (c: number) =>
      (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 });

    const lines: string[] = ["📋 Suivi des devis"];

    if (toExpire.length > 0) {
      lines.push("");
      lines.push(`⏳ ${toExpire.length} devis expiré${toExpire.length > 1 ? "s" : ""} (statut passé à « expired ») :`);
      for (const q of toExpire.slice(0, 10)) {
        lines.push(`· ${q.reference} · ${q.client_name} · ${eur(q.total_cents)} € · J-${q.days_since_sent}`);
      }
      if (toExpire.length > 10) lines.push(`  (et ${toExpire.length - 10} autre${toExpire.length - 10 > 1 ? "s" : ""})`);
    }

    if (toRelaunch.length > 0) {
      lines.push("");
      lines.push(`▸ ${toRelaunch.length} devis à relancer avant expiration (22-30 j) :`);
      for (const q of toRelaunch.slice(0, 10)) {
        const daysLeft = 30 - q.days_since_sent;
        lines.push(`· ${q.reference} · ${q.client_name} · ${eur(q.total_cents)} € · expire dans ${daysLeft} j`);
      }
    }

    lines.push("");
    lines.push("Ouvre /admin/agents/admin?tab=documents&sub=quote pour agir.");

    const result = await notifyMickael(lines.join("\n"));
    await logEvent(
      "admin",
      "expired_quotes_processed",
      {
        expired: toExpire.length,
        to_relaunch: toRelaunch.length,
        provider: result.ok ? result.provider : null,
      },
      result.ok
    );

    return NextResponse.json({
      ok: result.ok,
      expired: toExpire.length,
      to_relaunch: toRelaunch.length,
      sent: result.ok,
      provider: result.ok ? result.provider : undefined,
      error: !result.ok ? result.error : undefined,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[cron/admin-expired-quotes]", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
