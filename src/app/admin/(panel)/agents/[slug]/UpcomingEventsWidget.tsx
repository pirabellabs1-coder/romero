import Link from "next/link";
import { getAgent } from "@/lib/agents";
import {
  buildClient,
  listEvents,
  type CalendarEvent,
} from "@/lib/google-calendar";

/**
 * Widget "prochains événements" à afficher dans l'Overview de l'agent
 * WhatsApp. Se connecte à Google Calendar en direct via le refresh
 * token de la config. Si non-connecté ou erreur : petit panneau
 * d'incitation avec bouton vers l'onglet Canaux.
 */
type Props = { count?: number };

export default async function UpcomingEventsWidget({ count = 3 }: Props) {
  const inst = await getAgent("whatsapp").catch(() => null);
  const cfg = (inst?.config ?? {}) as {
    google_client_id?: string;
    google_client_secret?: string;
    google_refresh_token?: string;
    google_calendar_id?: string;
    google_timezone?: string;
  };

  const notConnected =
    !cfg.google_client_id ||
    !cfg.google_client_secret ||
    !cfg.google_refresh_token;

  if (notConnected) {
    return (
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Prochains événements</h2>
        <p style={{ marginTop: -6, marginBottom: 14, opacity: 0.75 }}>
          Reliez votre Google Agenda pour voir ici en direct vos 3 prochains
          rendez-vous — l'assistant s'appuie sur la même connexion pour
          répondre à vos demandes.
        </p>
        <Link
          href="/admin/agents/whatsapp?tab=channels"
          className="agent-btn agent-btn--primary"
          style={{ textDecoration: "none" }}
        >
          Connecter Google Agenda →
        </Link>
      </div>
    );
  }

  const client = await buildClient({
    refreshToken: cfg.google_refresh_token!,
    clientId: cfg.google_client_id!,
    clientSecret: cfg.google_client_secret!,
    calendarId: cfg.google_calendar_id,
    timeZone: cfg.google_timezone,
  });

  if (!client.ok) {
    return (
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Prochains événements</h2>
        <div className="agent-flash agent-flash--err">
          Impossible de joindre Google Calendar : {client.error}
        </div>
      </div>
    );
  }

  const now = new Date();
  // Fenêtre : maintenant → +14 jours pour être sûrs d'attraper N évts
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const list = await listEvents(client.client, {
    timeMinISO: now.toISOString(),
    timeMaxISO: to.toISOString(),
    maxResults: count,
  });

  if (!list.ok) {
    return (
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Prochains événements</h2>
        <div className="agent-flash agent-flash--err">{list.error}</div>
      </div>
    );
  }

  const events = list.events
    .filter((e) => e.status !== "cancelled")
    .slice(0, count);
  const tz = cfg.google_timezone || "Europe/Paris";

  return (
    <div className="agent-panel" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{count} prochains événements</h2>
        <Link
          href="/admin/agents/whatsapp?tab=timeline"
          style={{
            fontSize: 10.5,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--gold-light, #D4B57A)",
            textDecoration: "none",
          }}
        >
          Voir la semaine →
        </Link>
      </div>

      {events.length === 0 ? (
        <p style={{ opacity: 0.55, fontStyle: "italic" }}>
          Rien dans les 14 prochains jours — profitez-en pour respirer.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {events.map((e) => (
            <EventLine key={e.id} event={e} tz={tz} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventLine({ event, tz }: { event: CalendarEvent; tz: string }) {
  const s = event.start.dateTime || event.start.date;
  const en = event.end.dateTime || event.end.date;
  const startDate = s ? new Date(s) : null;
  const endDate = en ? new Date(en) : null;

  const dayLabel = startDate
    ? startDate.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        timeZone: tz,
      })
    : "?";
  const timeLabel = startDate
    ? event.start.dateTime
      ? `${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz })}${endDate ? " → " + endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : ""}`
      : "toute la journée"
    : "";

  const isWedding = /mariage|wedding|M\.\s*&\s*Mme/i.test(event.summary || "");
  const isMeet = Boolean((event as { hangoutLink?: string }).hangoutLink);

  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "12px 14px",
        background: "rgba(0,0,0,0.16)",
        border: "1px solid rgba(184,151,90,0.20)",
        borderRadius: 4,
      }}
    >
      <div style={{ flex: "0 0 auto", textAlign: "center", minWidth: 60 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--gold-light, #D4B57A)",
            marginBottom: 4,
          }}
        >
          {dayLabel}
        </div>
        <div
          style={{
            fontFamily: "var(--serif, Georgia, serif)",
            fontStyle: "italic",
            fontSize: 14,
            color: "#F4EFE3",
          }}
        >
          {timeLabel}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: "#F4EFE3",
            fontWeight: 500,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isWedding ? "💍 " : ""}
          {isMeet ? "📹 " : ""}
          {event.summary || "(sans titre)"}
        </div>
        {event.location ? (
          <div
            style={{
              fontSize: 12,
              color: "rgba(244,239,227,0.6)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.location}
          </div>
        ) : null}
      </div>
    </li>
  );
}
