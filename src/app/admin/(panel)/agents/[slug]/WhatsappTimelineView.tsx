import Link from "next/link";
import { getAgent } from "@/lib/agents";
import {
  buildClient,
  listEvents,
  type CalendarEvent,
} from "@/lib/google-calendar";

/**
 * Vue Timeline pour l'agent WhatsApp : 14 prochains jours d'événements
 * Google Calendar regroupés par jour. Alternative visuelle au calendrier
 * marketing — ici on privilégie l'agenda linéaire.
 */
export default async function WhatsappTimelineView() {
  const inst = await getAgent("whatsapp").catch(() => null);
  const cfg = (inst?.config ?? {}) as {
    google_client_id?: string;
    google_client_secret?: string;
    google_refresh_token?: string;
    google_calendar_id?: string;
    google_timezone?: string;
  };

  if (!cfg.google_client_id || !cfg.google_client_secret || !cfg.google_refresh_token) {
    return (
      <div className="agent-detail">
        <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Timeline agenda</h2>
          <p>
            Reliez d'abord Google Agenda pour voir votre timeline en direct.
          </p>
          <Link
            href="/admin/agents/whatsapp?tab=channels"
            className="agent-btn agent-btn--primary"
            style={{ textDecoration: "none" }}
          >
            Connecter Google Agenda →
          </Link>
        </div>
      </div>
    );
  }

  const client = await buildClient({
    refreshToken: cfg.google_refresh_token,
    clientId: cfg.google_client_id,
    clientSecret: cfg.google_client_secret,
    calendarId: cfg.google_calendar_id,
    timeZone: cfg.google_timezone,
  });
  if (!client.ok) {
    return (
      <div className="agent-detail">
        <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Timeline agenda</h2>
          <div className="agent-flash agent-flash--err">
            Impossible de joindre Google Calendar : {client.error}
          </div>
        </div>
      </div>
    );
  }

  const tz = cfg.google_timezone || "Europe/Paris";
  const now = new Date();
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const list = await listEvents(client.client, {
    timeMinISO: now.toISOString(),
    timeMaxISO: to.toISOString(),
    maxResults: 250,
  });

  if (!list.ok) {
    return (
      <div className="agent-detail">
        <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Timeline agenda</h2>
          <div className="agent-flash agent-flash--err">{list.error}</div>
        </div>
      </div>
    );
  }

  const events = list.events.filter((e) => e.status !== "cancelled");
  const totalHours = events.reduce((sum, e) => {
    const s = e.start.dateTime;
    const en = e.end.dateTime;
    if (!s || !en) return sum;
    return sum + (new Date(en).getTime() - new Date(s).getTime()) / 3_600_000;
  }, 0);

  // Regroupe par jour
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const s = e.start.dateTime || e.start.date;
    if (!s) continue;
    const key = new Date(s).toISOString().slice(0, 10);
    const arr = byDay.get(key) || [];
    arr.push(e);
    byDay.set(key, arr);
  }
  const dayKeys = Array.from(byDay.keys()).sort();

  // Compte les mariages, meets, etc.
  const wedCount = events.filter((e) => /mariage|wedding|M\.\s*&\s*Mme/i.test(e.summary || "")).length;
  const meetCount = events.filter((e) => Boolean((e as { hangoutLink?: string }).hangoutLink)).length;

  return (
    <div className="agent-detail">
      <div style={{ gridColumn: "1 / -1" }}>
        {/* KPIs */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2>Timeline — 14 prochains jours</h2>
          <div className="agent-kpi-grid">
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{events.length}</div>
              <div className="agent-kpi__label">Événements</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{Math.round(totalHours)}</div>
              <div className="agent-kpi__label">Heures bloquées</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{wedCount}</div>
              <div className="agent-kpi__label">Mariages</div>
            </div>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{meetCount}</div>
              <div className="agent-kpi__label">Visioconférences</div>
            </div>
          </div>
        </div>

        {/* Liste par jour */}
        <div className="agent-panel">
          <h2>Détail par jour</h2>
          {dayKeys.length === 0 ? (
            <p style={{ opacity: 0.55, fontStyle: "italic" }}>
              Rien de prévu dans les 14 prochains jours.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {dayKeys.map((k) => (
                <DayGroup
                  key={k}
                  dayKey={k}
                  events={(byDay.get(k) || []).sort((a, b) => {
                    const sa = new Date(a.start.dateTime || a.start.date || "").getTime();
                    const sb = new Date(b.start.dateTime || b.start.date || "").getTime();
                    return sa - sb;
                  })}
                  tz={tz}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayGroup({
  dayKey,
  events,
  tz,
}: {
  dayKey: string;
  events: CalendarEvent[];
  tz: string;
}) {
  const date = new Date(dayKey);
  const isToday = dayKey === new Date().toISOString().slice(0, 10);
  const dayLabel = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  });
  const isWedDay = events.some((e) => /mariage|wedding|M\.\s*&\s*Mme/i.test(e.summary || ""));

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: "1px solid rgba(184,151,90,0.20)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--serif, Georgia, serif)",
            fontStyle: "italic",
            fontSize: 17,
            color: isToday ? "var(--gold-light, #D4B57A)" : "#F4EFE3",
            textTransform: "capitalize",
          }}
        >
          {dayLabel}
        </span>
        {isToday ? (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: "#9DCE9D",
              padding: "3px 8px",
              border: "1px solid rgba(157,206,157,0.35)",
              borderRadius: 3,
            }}
          >
            Aujourd'hui
          </span>
        ) : null}
        {isWedDay ? (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: "#E0B96A",
              padding: "3px 8px",
              border: "1px solid rgba(224,185,106,0.35)",
              borderRadius: 3,
            }}
          >
            💍 Mariage
          </span>
        ) : null}
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {events.map((e) => (
          <TimelineRow key={e.id} event={e} tz={tz} />
        ))}
      </ul>
    </div>
  );
}

function TimelineRow({ event, tz }: { event: CalendarEvent; tz: string }) {
  const s = event.start.dateTime;
  const en = event.end.dateTime;
  const startStr = s
    ? new Date(s).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      })
    : "";
  const endStr = en
    ? new Date(en).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: tz,
      })
    : "";
  const isMeet = Boolean((event as { hangoutLink?: string }).hangoutLink);

  return (
    <li
      style={{
        display: "flex",
        gap: 14,
        padding: "10px 12px",
        background: "rgba(0,0,0,0.14)",
        borderRadius: 4,
        borderLeft: "3px solid var(--gold, #B8975A)",
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          minWidth: 100,
          fontFamily: "var(--serif, Georgia, serif)",
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--gold-light, #D4B57A)",
        }}
      >
        {s ? `${startStr} → ${endStr}` : "Toute la journée"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "#F4EFE3", fontWeight: 500 }}>
          {isMeet ? "📹 " : ""}
          {event.summary || "(sans titre)"}
        </div>
        {event.location ? (
          <div
            style={{
              fontSize: 12,
              color: "rgba(244,239,227,0.65)",
              marginTop: 2,
            }}
          >
            📍 {event.location}
          </div>
        ) : null}
        {event.description && event.description.length < 200 ? (
          <div
            style={{
              fontSize: 12,
              color: "rgba(244,239,227,0.55)",
              marginTop: 4,
              fontStyle: "italic",
            }}
          >
            {event.description.replace(/https?:\/\/\S+/g, "").slice(0, 180)}
          </div>
        ) : null}
      </div>
    </li>
  );
}
