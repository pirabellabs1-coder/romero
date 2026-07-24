/**
 * GET /api/cron/wedding-countdown
 * ──────────────────────────────────────────────────────────────
 * Cron quotidien à 8 h Paris (06:00 UTC hiver / 05:00 UTC été).
 * Balaie admin_contacts pour repérer les mariages à venir dans
 * des créneaux d'anticipation clés :
 *   • J-180 (6 mois)  → moment idéal du prep call détaillé
 *   • J-30  (1 mois)  → dernière ligne droite, timing à figer
 *   • J-7   (1 semaine) → vérification lieu et météo
 *   • J-1   (veille) → check final
 *
 * À chaque jour de match, envoie une notif WhatsApp/Telegram
 * groupée à Mickael avec la liste des couples concernés.
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

type UpcomingWedding = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  wedding_date: string;
  wedding_location: string | null;
  days_until: number;
  checkpoint: number;
};

// Créneaux d'anticipation retenus (en jours). L'agent lit
// admin_contacts.wedding_date qui est une DATE — pas d'heures.
const CHECKPOINTS = [180, 30, 7, 1];

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // Une seule requête : tous les mariages dont un seuil (J-180/30/7/1)
    // est atteint (days_until <= N) ET pas encore notifié pour ce couple.
    // Le <= (au lieu d'une égalité stricte) rattrape les jours manqués si
    // le cron n'a pas tourné pile le jour du checkpoint.
    const rows = await query<UpcomingWedding>(
      `SELECT
         c.id, c.name, c.email, c.phone,
         c.wedding_date::text,
         c.wedding_location,
         (c.wedding_date - CURRENT_DATE)::int AS days_until,
         cp.checkpoint
       FROM admin_contacts c
       CROSS JOIN unnest($1::int[]) AS cp(checkpoint)
       WHERE c.wedding_date IS NOT NULL
         AND c.wedding_date > CURRENT_DATE
         AND (c.wedding_date - CURRENT_DATE)::int <= cp.checkpoint
         AND NOT EXISTS (
           SELECT 1 FROM countdown_notifications n
           WHERE n.contact_id = c.id AND n.checkpoint = cp.checkpoint
         )
       ORDER BY cp.checkpoint ASC, c.wedding_date ASC, c.name ASC`,
      [CHECKPOINTS]
    );

    if (rows.length === 0) {
      await logEvent("admin", "wedding_countdown_check", { matches: 0 });
      return NextResponse.json({ ok: true, matches: 0, sent: false });
    }

    const text = formatCountdownMessage(rows);
    const result = await notifyMickael(text);

    // Mémorise les checkpoints notifiés pour garantir exactement-une-fois :
    // uniquement si l'envoi a réussi (sinon on retentera au prochain cron).
    if (result.ok) {
      await execute(
        `INSERT INTO countdown_notifications (contact_id, checkpoint)
         SELECT * FROM unnest($1::bigint[], $2::int[])
         ON CONFLICT (contact_id, checkpoint) DO NOTHING`,
        [rows.map((r) => r.id), rows.map((r) => r.checkpoint)]
      );
    }

    await logEvent(
      "admin",
      "wedding_countdown_sent",
      {
        matches: rows.length,
        by_checkpoint: rows.reduce((acc, r) => {
          acc[r.checkpoint] = (acc[r.checkpoint] ?? 0) + 1;
          return acc;
        }, {} as Record<number, number>),
        provider: result.ok ? result.provider : null,
      },
      result.ok
    );

    return NextResponse.json({
      ok: result.ok,
      matches: rows.length,
      sent: result.ok,
      provider: result.ok ? result.provider : undefined,
      error: !result.ok ? result.error : undefined,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[cron/wedding-countdown]", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

function formatCountdownMessage(rows: UpcomingWedding[]): string {
  // Regroupe par checkpoint (J-180/30/7/1) pour un rendu bien lisible. On
  // groupe par seuil et non par days_until : en cas de rattrapage le
  // days_until réel peut différer du seuil, mais l'étape reste la même.
  const groups = new Map<number, UpcomingWedding[]>();
  for (const r of rows) {
    const arr = groups.get(r.checkpoint) || [];
    arr.push(r);
    groups.set(r.checkpoint, arr);
  }

  const lines: string[] = ["💍 Mariages à venir — étapes clés", ""];

  const orderedCheckpoints = [...groups.keys()].sort((a, b) => a - b);
  for (const days of orderedCheckpoints) {
    const label =
      days === 180
        ? "▸ Dans 6 mois — moment idéal pour un prep call détaillé"
        : days === 30
        ? "▸ Dans 1 mois — dernière ligne droite, figer le timing"
        : days === 7
        ? "▸ Dans 7 jours — vérif lieu, météo, prestataires"
        : days === 1
        ? "▸ DEMAIN — dernier check"
        : `▸ Dans ${days} jour${days > 1 ? "s" : ""}`;

    lines.push(label);
    for (const r of groups.get(days) || []) {
      const dateFmt = new Date(r.wedding_date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const parts = [
        `· ${r.name}`,
        r.wedding_location ? `📍 ${r.wedding_location}` : null,
        `📅 ${dateFmt}`,
      ].filter(Boolean);
      lines.push(parts.join(" · "));
      if (r.email || r.phone) {
        const contact = [r.email, r.phone].filter(Boolean).join(" · ");
        lines.push(`  ↳ ${contact}`);
      }
    }
    lines.push("");
  }

  lines.push("Ouvre /admin/agents/admin?tab=documents&sub=clients pour la fiche complète.");
  return lines.join("\n");
}
