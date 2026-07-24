/**
 * GET /api/cron/admin-payment-reminders
 * ──────────────────────────────────────────────────────────────
 * Rappel quotidien à 8 h Paris (07:00 UTC hiver / 06:00 UTC été).
 * Passe en revue les factures 'sent' dont la due_date est dépassée
 * ou proche (dans 3 j). Envoie une notification WhatsApp/Telegram
 * à Mickael pour qu'il puisse déclencher la relance manuellement.
 *
 * On n'envoie PAS d'email au client automatiquement — la décision
 * de relancer reste humaine (délicatesse commerciale).
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

type OverdueInvoice = {
  id: number;
  reference: string;
  client_name: string;
  total_cents: number;
  due_date: string;
  days_overdue: number;
};

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // Factures en retard (due_date < today) + factures qui approchent
    // (due_date entre aujourd'hui et J+3).
    const rows = await query<OverdueInvoice>(
      `SELECT
         id, reference, client_name, total_cents, due_date::text,
         (CURRENT_DATE - due_date)::int AS days_overdue
       FROM admin_documents
       WHERE doc_type = 'invoice'
         AND status = 'sent'
         AND due_date IS NOT NULL
         AND due_date <= CURRENT_DATE + INTERVAL '3 days'
       ORDER BY due_date ASC
       LIMIT 30`
    );

    if (rows.length === 0) {
      await logEvent("admin", "payment_reminders_check", { pending: 0 });
      return NextResponse.json({ ok: true, pending: 0, sent: false });
    }

    // Sépare retards vs à venir
    const overdue = rows.filter((r) => r.days_overdue > 0);
    const upcoming = rows.filter((r) => r.days_overdue <= 0);

    const eur = (c: number) =>
      (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 });
    const totalOverdue = overdue.reduce((s, r) => s + r.total_cents, 0);
    const totalUpcoming = upcoming.reduce((s, r) => s + r.total_cents, 0);

    const lines: string[] = ["💳 Rappel paiements du jour", ""];

    if (overdue.length > 0) {
      lines.push(`⚠ ${overdue.length} facture${overdue.length > 1 ? "s" : ""} en retard — total ${eur(totalOverdue)} € :`);
      for (const r of overdue.slice(0, 10)) {
        lines.push(
          `· ${r.reference} · ${r.client_name} · ${eur(r.total_cents)} € · J+${r.days_overdue}`
        );
      }
      if (overdue.length > 10) lines.push(`  (et ${overdue.length - 10} autre${overdue.length - 10 > 1 ? "s" : ""})`);
      lines.push("");
    }

    if (upcoming.length > 0) {
      lines.push(`▸ ${upcoming.length} facture${upcoming.length > 1 ? "s" : ""} à venir (≤ 3 j) — ${eur(totalUpcoming)} € :`);
      for (const r of upcoming.slice(0, 10)) {
        const dueDate = new Date(r.due_date).toLocaleDateString("fr-FR");
        lines.push(`· ${r.reference} · ${r.client_name} · ${eur(r.total_cents)} € · échéance ${dueDate}`);
      }
      lines.push("");
    }

    lines.push("Ouvre /admin/agents/admin?tab=documents&sub=invoice pour déclencher les relances.");

    const result = await notifyMickael(lines.join("\n"));
    await logEvent(
      "admin",
      "payment_reminders_sent",
      { overdue: overdue.length, upcoming: upcoming.length, provider: result.ok ? result.provider : null },
      result.ok
    );

    return NextResponse.json({
      ok: result.ok,
      overdue: overdue.length,
      upcoming: upcoming.length,
      sent: result.ok,
      provider: result.ok ? result.provider : undefined,
      error: !result.ok ? result.error : undefined,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[cron/admin-payment-reminders]", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
