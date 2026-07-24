/**
 * GET /api/cron/whatsapp-reminders
 * ──────────────────────────────────────────────────────────────
 * Rappels quotidiens à 8 h Paris (07:00 UTC en hiver, 06:00 UTC en été).
 * Le cron Vercel est configuré en UTC à 06:00 tous les jours — on
 * accepte le petit décalage lié à l'heure d'été plutôt que 2 crons.
 *
 * Envoie à Mickael la liste des événements des prochaines 24 h via
 * notifyMickael (WhatsApp Cloud si configuré, Telegram sinon).
 *
 * Sécurité : Bearer CRON_SECRET (identique à publish-scheduled).
 * Idempotence : envoyer 2× la même liste ne casse rien mais on
 * consomme le quota. Le cron unique de Vercel garantit un seul
 * appel par tranche horaire.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgent, logEvent } from "@/lib/agents";
import {
  buildClient,
  listEvents,
  type CalendarEvent,
} from "@/lib/google-calendar";
import { notifyMickael } from "@/lib/whatsapp-notify";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const inst = await getAgent("whatsapp");
    if (!inst)
      return NextResponse.json({ ok: false, error: "agent whatsapp indisponible" }, { status: 503 });
    const cfg = inst.config as {
      google_client_id?: string;
      google_client_secret?: string;
      google_refresh_token?: string;
      google_calendar_id?: string;
      google_timezone?: string;
    };
    if (!cfg.google_client_id || !cfg.google_client_secret || !cfg.google_refresh_token) {
      return NextResponse.json({
        ok: true,
        skipped: "google_calendar_not_connected",
      });
    }

    const client = await buildClient({
      refreshToken: cfg.google_refresh_token,
      clientId: cfg.google_client_id,
      clientSecret: cfg.google_client_secret,
      calendarId: cfg.google_calendar_id,
      timeZone: cfg.google_timezone,
    });
    if (!client.ok)
      return NextResponse.json({ ok: false, error: client.error }, { status: 502 });

    const tz = cfg.google_timezone || "Europe/Paris";
    const now = new Date();
    // Fenêtre : maintenant → +24 h
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const list = await listEvents(client.client, {
      timeMinISO: now.toISOString(),
      timeMaxISO: in24h.toISOString(),
      maxResults: 50,
    });
    if (!list.ok)
      return NextResponse.json({ ok: false, error: list.error }, { status: 502 });

    const events = list.events.filter((e) => e.status !== "cancelled");
    const text = formatDailyReminder(events, tz);

    // Si aucun événement : on n'envoie rien pour ne pas polluer.
    if (events.length === 0) {
      await logEvent("whatsapp", "daily_reminder_empty", { window_hours: 24 });
      return NextResponse.json({ ok: true, events: 0, sent: false });
    }

    const result = await notifyMickael(text);
    await logEvent(
      "whatsapp",
      "daily_reminder_sent",
      { events: events.length, provider: result.ok ? result.provider : null },
      result.ok
    );

    return NextResponse.json({
      ok: result.ok,
      events: events.length,
      sent: result.ok,
      provider: result.ok ? result.provider : undefined,
      error: !result.ok ? result.error : undefined,
      ran_at: new Date().toISOString(),
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[cron/whatsapp-reminders]", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

function formatDailyReminder(events: CalendarEvent[], tz: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  };
  const dayOpts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  };
  const now = new Date();
  const header = `📅 Rappel du jour — ${now.toLocaleDateString("fr-FR", dayOpts)}\n`;

  // Regroupe par jour (aujourd'hui vs demain)
  const todayKey = now.toLocaleDateString("fr-FR", { timeZone: tz });
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowKey = tomorrow.toLocaleDateString("fr-FR", { timeZone: tz });

  type Bucket = { label: string; items: CalendarEvent[] };
  const buckets: Bucket[] = [
    { label: "Aujourd'hui", items: [] },
    { label: "Demain", items: [] },
  ];

  for (const e of events) {
    const s = e.start.dateTime || e.start.date;
    if (!s) continue;
    const d = new Date(s);
    const key = d.toLocaleDateString("fr-FR", { timeZone: tz });
    if (key === todayKey) buckets[0].items.push(e);
    else if (key === tomorrowKey) buckets[1].items.push(e);
  }

  const lines: string[] = [header];
  for (const b of buckets) {
    if (b.items.length === 0) continue;
    lines.push(`\n▸ ${b.label}`);
    for (const e of b.items) {
      const start = e.start.dateTime
        ? new Date(e.start.dateTime).toLocaleTimeString("fr-FR", opts)
        : "toute la journée";
      const end = e.end.dateTime
        ? new Date(e.end.dateTime).toLocaleTimeString("fr-FR", opts)
        : "";
      const timeStr = e.end.dateTime ? `${start} → ${end}` : start;
      const loc = e.location ? ` · ${e.location}` : "";
      lines.push(`· ${timeStr} · ${e.summary || "(sans titre)"}${loc}`);
    }
  }

  return lines.join("\n");
}
