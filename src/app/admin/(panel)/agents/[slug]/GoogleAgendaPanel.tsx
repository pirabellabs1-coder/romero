import Link from "next/link";
import { buildClient, listEvents } from "@/lib/google-calendar";

type Props = {
  config: Record<string, string>;
};

// Test la connexion en tentant de lister les événements du jour.
// Si les creds sont incomplets, on affiche un guide de setup.
export default async function GoogleAgendaPanel({ config }: Props) {
  const hasClient = Boolean(config.google_client_id && config.google_client_secret);
  const hasRefresh = Boolean(config.google_refresh_token);

  let connectionStatus:
    | { ok: true; email: string | null; upcomingCount: number; nextEvent: string | null }
    | { ok: false; error: string }
    | null = null;

  if (hasClient && hasRefresh) {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const client = await buildClient({
      refreshToken: config.google_refresh_token,
      clientId: config.google_client_id,
      clientSecret: config.google_client_secret,
      calendarId: config.google_calendar_id,
      timeZone: config.google_timezone,
    });
    if (!client.ok) {
      connectionStatus = { ok: false, error: client.error };
    } else {
      const events = await listEvents(client.client, {
        timeMinISO: now.toISOString(),
        timeMaxISO: in7d.toISOString(),
        maxResults: 10,
      });
      if (!events.ok) {
        connectionStatus = { ok: false, error: events.error };
      } else {
        const upcoming = events.events.filter((e) => e.status !== "cancelled");
        connectionStatus = {
          ok: true,
          email: config.google_account_email || null,
          upcomingCount: upcoming.length,
          nextEvent: upcoming[0]
            ? `${upcoming[0].start.dateTime || upcoming[0].start.date} · ${upcoming[0].summary || "(sans titre)"}`
            : null,
        };
      }
    }
  }

  return (
    <div className="agent-panel" style={{ marginBottom: 22 }}>
      <h2>Google Agenda</h2>
      <p style={{ marginTop: -6, marginBottom: 18 }}>
        L'assistant WhatsApp/Telegram utilise cette connexion pour créer,
        modifier et consulter vos rendez-vous.
      </p>

      {!hasClient ? (
        <div className="agent-flash agent-flash--err">
          Renseignez d'abord <code>google_client_id</code> et{" "}
          <code>google_client_secret</code> dans l'onglet Configuration.
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--gold-light,#D4B57A)" }}>
              Comment les obtenir ?
            </summary>
            <ol style={{ marginTop: 10, paddingLeft: 22, lineHeight: 1.7, fontSize: 13 }}>
              <li>
                Aller sur{" "}
                <a
                  href="https://console.cloud.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--gold-light,#D4B57A)" }}
                >
                  console.cloud.google.com
                </a>{" "}
                → créer un projet « Romero Assistant ».
              </li>
              <li>APIs & Services → Enabled APIs → activer « Google Calendar API ».</li>
              <li>
                APIs & Services → OAuth consent screen → External → remplir les infos
                minimales (nom d'app, e-mail).
              </li>
              <li>
                APIs & Services → Credentials → Create OAuth client ID →{" "}
                <strong>Application type : Web application</strong>.
              </li>
              <li>
                Authorized redirect URIs → ajouter :{" "}
                <code>https://romerophotography.fr/api/auth/google/callback</code>
              </li>
              <li>Copier Client ID + Client Secret dans l'onglet Configuration ici.</li>
            </ol>
          </details>
        </div>
      ) : !hasRefresh ? (
        <>
          <div className="agent-flash agent-flash--ok" style={{ marginBottom: 14 }}>
            Client OAuth configuré. Il ne reste qu'à autoriser l'accès à
            votre agenda.
          </div>
          <Link
            href="/api/auth/google/start"
            className="agent-btn agent-btn--primary"
            style={{ textDecoration: "none" }}
          >
            Connecter Google Agenda →
          </Link>
        </>
      ) : connectionStatus && connectionStatus.ok ? (
        <>
          <div className="agent-flash agent-flash--ok" style={{ marginBottom: 18 }}>
            ✓ Connecté{connectionStatus.email ? ` en tant que ${connectionStatus.email}` : ""}.
          </div>
          <div className="agent-kpi-grid" style={{ marginBottom: 18 }}>
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{connectionStatus.upcomingCount}</div>
              <div className="agent-kpi__label">Événements 7 jours</div>
            </div>
            <div className="agent-kpi agent-kpi--ok">
              <div className="agent-kpi__value">OK</div>
              <div className="agent-kpi__label">Lecture / Écriture</div>
            </div>
          </div>
          {connectionStatus.nextEvent ? (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(0,0,0,0.22)",
                border: "1px solid rgba(184,151,90,0.18)",
                borderRadius: 4,
                fontSize: 13,
                color: "rgba(244,239,227,0.85)",
              }}
            >
              <strong style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold-light,#D4B57A)", display: "block", marginBottom: 6 }}>
                Prochain événement
              </strong>
              {connectionStatus.nextEvent}
            </div>
          ) : (
            <p style={{ opacity: 0.6, fontSize: 13, fontStyle: "italic" }}>
              Aucun événement à venir dans les 7 prochains jours.
            </p>
          )}
          <div className="agent-actions" style={{ marginTop: 18 }}>
            <Link
              href="/api/auth/google/start"
              className="agent-btn agent-btn--ghost"
              style={{ textDecoration: "none" }}
            >
              Reconnecter (changer de compte)
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="agent-flash agent-flash--err" style={{ marginBottom: 14 }}>
            Refresh token présent mais la connexion échoue :{" "}
            {connectionStatus?.ok === false ? connectionStatus.error : "raison inconnue"}
          </div>
          <Link
            href="/api/auth/google/start"
            className="agent-btn agent-btn--primary"
            style={{ textDecoration: "none" }}
          >
            Reconnecter Google Agenda
          </Link>
        </>
      )}
    </div>
  );
}
