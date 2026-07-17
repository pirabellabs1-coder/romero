import type { AgentEvent } from "@/lib/agents";

type Props = { events: AgentEvent[] };

export default function ActivityFeed({ events }: Props) {
  return (
    <div className="agent-detail">
      <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Journal d'activité</h2>
        <p style={{ marginTop: -6, marginBottom: 20 }}>
          Chaque action de l'agent (conversation, RDV pris, post publié, erreur…)
          est loggée ici. Cliquez sur une ligne pour voir le détail brut.
        </p>

        {events.length === 0 ? (
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            Aucun événement enregistré. Le flux apparaîtra dès la première action
            de l'agent.
          </p>
        ) : (
          <div className="agent-pg-history">
            {events.map((e) => (
              <details key={e.id} className="agent-pg-turn">
                <summary>
                  <span
                    className={`agent-badge agent-badge--${e.success ? "installed" : "error"}`}
                    style={{ padding: "3px 8px", fontSize: 9 }}
                  >
                    {e.event_type}
                  </span>
                  <span className="agent-pg-turn__preview">
                    {shortPayload(e.payload)}
                  </span>
                  <span className="agent-pg-turn__meta">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </span>
                </summary>
                <div className="agent-pg-turn__body">
                  <div className="agent-pg-turn__label">Payload complet</div>
                  <pre>{JSON.stringify(e.payload, null, 2)}</pre>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function shortPayload(p: Record<string, unknown>): string {
  const entries = Object.entries(p);
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 3)
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return `${k}=${s.slice(0, 40)}${s.length > 40 ? "…" : ""}`;
    })
    .join(" · ");
}
