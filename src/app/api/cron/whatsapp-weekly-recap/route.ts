/**
 * GET /api/cron/whatsapp-weekly-recap
 * ──────────────────────────────────────────────────────────────
 * Récap hebdomadaire chaque lundi à 7 h Paris (06:00 UTC hiver /
 * 05:00 UTC été — cron Vercel en UTC 05:00 tous les lundis).
 *
 * Envoie à Mickael le récap de la semaine à venir (lundi → dimanche)
 * via notifyMickael. Format : sous-titre par jour + événements
 * chronologiques.
 *
 * Sécurité : Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgent, logEvent } from "@/lib/agents";
import {
  buildClient,
  listEvents,
  type CalendarEvent,
} from "@/lib/google-calendar";
import { notifyMickael } from "@/lib/whatsapp-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  if (secret) {
    const expected = `Bearer ${secret}`;
    if (authHeader !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const inst = await getAgent("whatsapp");
    if (!inst)
      return NextResponse.json(
        { ok: false, error: "agent whatsapp indisponible" },
        { status: 503 }
      );
    const cfg = inst.config as {
      google_client_id?: string;
      google_client_secret?: string;
      google_refresh_token?: string;
      google_calendar_id?: string;
      google_timezone?: string;
    };
    if (!cfg.google_client_id || !cfg.google_client_secret || !cfg.google_refresh_token) {
      return NextResponse.json({ ok: true, skipped: "google_calendar_not_connected" });
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
    // Fenêtre : lundi 00:00 → lundi suivant 00:00 dans le fuseau
    const now = new Date();
    const from = startOfMondayInTZ(now, tz);
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

    const list = await listEvents(client.client, {
      timeMinISO: from.toISOString(),
      timeMaxISO: to.toISOString(),
      maxResults: 200,
    });
    if (!list.ok)
      return NextResponse.json({ ok: false, error: list.error }, { status: 502 });

    const events = list.events.filter((e) => e.status !== "cancelled");
    const text = formatWeeklyRecap(events, tz, from);

    // Toujours envoyer, même semaine vide — Mickael veut savoir « rien de prévu ».
    const result = await notifyMickael(text);
    await logEvent(
      "whatsapp",
      "weekly_recap_sent",
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
    console.error("[cron/whatsapp-weekly-recap]", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

function startOfMondayInTZ(d: Date, _tz: string): Date {
  // Approche pragmatique : on prend le lundi de la semaine en cours
  // (potentiellement aujourd'hui si lundi), 00 h dans UTC — accepté
  // que la fenêtre couvre lundi 01 h UTC en été à cause du décalage.
  const day = d.getUTCDay(); // 0 = dimanche
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getTime() - daysToMonday * 24 * 60 * 60 * 1000);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function formatWeeklyRecap(
  events: CalendarEvent[],
  tz: string,
  weekStart: Date
): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  };
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const label = `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: tz })} → ${weekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: tz })}`;
  const header = `📋 Récap de la semaine — ${label}`;

  if (events.length === 0) {
    return `${header}\n\nRien de prévu. Semaine libre.`;
  }

  // Regroupe par jour
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const s = e.start.dateTime || e.start.date;
    if (!s) continue;
    const d = new Date(s);
    const key = d.toISOString().slice(0, 10);
    const arr = byDay.get(key) || [];
    arr.push(e);
    byDay.set(key, arr);
  }

  const dayKeys = Array.from(byDay.keys()).sort();
  const lines: string[] = [header];

  for (const key of dayKeys) {
    const items = (byDay.get(key) || []).sort((a, b) => {
      const sa = new Date(a.start.dateTime || a.start.date || "").getTime();
      const sb = new Date(b.start.dateTime || b.start.date || "").getTime();
      return sa - sb;
    });
    const d = new Date(key);
    const dayLabel = d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: tz,
    });
    lines.push(`\n▸ ${dayLabel[0].toUpperCase() + dayLabel.slice(1)}`);
    for (const e of items) {
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
