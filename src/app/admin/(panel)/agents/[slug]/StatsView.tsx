import type { AgentStats } from "@/lib/agents";

type Props = { stats: AgentStats };

// Rendu SVG pur — pas de lib externe. Un simple bar chart empilé
// « succès / échec » par jour sur 30 jours.
export default function StatsView({ stats }: Props) {
  const successRate =
    stats.total_events > 0
      ? Math.round((stats.success_events / stats.total_events) * 100)
      : 0;

  return (
    <div className="agent-detail">
      <div style={{ gridColumn: "1 / -1" }}>
        {/* Chiffres clés */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2>Vue d'ensemble (30 derniers jours)</h2>
          <div className="agent-kpi-grid">
            <div className="agent-kpi agent-kpi--default">
              <div className="agent-kpi__value">{stats.total_events}</div>
              <div className="agent-kpi__label">Événements totaux</div>
            </div>
            <div className="agent-kpi agent-kpi--ok">
              <div className="agent-kpi__value">{stats.success_events}</div>
              <div className="agent-kpi__label">Succès</div>
            </div>
            <div className={`agent-kpi agent-kpi--${stats.failure_events > 0 ? "err" : "muted"}`}>
              <div className="agent-kpi__value">{stats.failure_events}</div>
              <div className="agent-kpi__label">Erreurs</div>
            </div>
            <div className={`agent-kpi agent-kpi--${successRate >= 90 ? "ok" : successRate >= 70 ? "default" : "err"}`}>
              <div className="agent-kpi__value">{successRate}%</div>
              <div className="agent-kpi__label">Taux de succès</div>
            </div>
          </div>
        </div>

        {/* Timeline 30 jours */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2>Activité — 30 derniers jours</h2>
          {stats.daily.length === 0 ? (
            <p style={{ opacity: 0.55, fontStyle: "italic" }}>
              Aucun événement enregistré. Les stats apparaîtront ici dès que
              l'agent commencera à recevoir du trafic.
            </p>
          ) : (
            <DailyBars daily={stats.daily} />
          )}
        </div>

        {/* Répartition par type */}
        <div className="agent-panel">
          <h2>Répartition par type d'événement</h2>
          {stats.by_type.length === 0 ? (
            <p style={{ opacity: 0.55, fontStyle: "italic" }}>
              Aucune donnée. Chaque interaction (conversation, RDV pris, post
              généré, etc.) apparaîtra ici classée par type.
            </p>
          ) : (
            <table className="agent-stats-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Occurrences</th>
                  <th style={{ textAlign: "right" }}>% du total</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_type.map((r) => (
                  <tr key={r.event_type}>
                    <td>
                      <code>{r.event_type}</code>
                    </td>
                    <td style={{ textAlign: "right" }}>{r.count}</td>
                    <td style={{ textAlign: "right", opacity: 0.7 }}>
                      {Math.round((r.count / stats.total_events) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function DailyBars({
  daily,
}: {
  daily: Array<{ day: string; count: number; success: number }>;
}) {
  // On complète la série jusqu'à 30 jours pour éviter les trous visuels.
  // Les jours sans event apparaissent comme des barres vides.
  const map = new Map(daily.map((d) => [d.day, d]));
  const points: Array<{ day: string; count: number; success: number }> = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const hit = map.get(key);
    points.push({
      day: key,
      count: hit?.count ?? 0,
      success: hit?.success ?? 0,
    });
  }
  const max = Math.max(1, ...points.map((p) => p.count));
  const W = 720;
  const H = 180;
  const P = 16;
  const barW = (W - P * 2) / points.length - 2;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H + 30}`}
        style={{ width: "100%", minWidth: 600, height: "auto" }}
        role="img"
        aria-label="Graphe d'activité sur 30 jours"
      >
        {/* Grille horizontale */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={P}
            x2={W - P}
            y1={P + (H - P * 2) * (1 - t)}
            y2={P + (H - P * 2) * (1 - t)}
            stroke="rgba(184,151,90,0.14)"
            strokeWidth={0.5}
          />
        ))}
        {/* Barres */}
        {points.map((p, i) => {
          const x = P + i * (barW + 2);
          const totalH = (H - P * 2) * (p.count / max);
          const okH = (H - P * 2) * (p.success / max);
          const failH = totalH - okH;
          return (
            <g key={p.day}>
              {/* échecs (rouge, dessous du total) */}
              {failH > 0 ? (
                <rect
                  x={x}
                  y={P + (H - P * 2) - totalH}
                  width={barW}
                  height={failH}
                  fill="#E48A8A"
                  opacity={0.75}
                />
              ) : null}
              {/* succès (gold, empilé au-dessus) */}
              {okH > 0 ? (
                <rect
                  x={x}
                  y={P + (H - P * 2) - okH}
                  width={barW}
                  height={okH}
                  fill="var(--gold, #B8975A)"
                />
              ) : null}
            </g>
          );
        })}
        {/* Labels bornes */}
        <text x={P} y={H + 20} fontSize="10" fill="rgba(244,239,227,0.5)">
          {points[0].day}
        </text>
        <text
          x={W - P}
          y={H + 20}
          fontSize="10"
          fill="rgba(244,239,227,0.5)"
          textAnchor="end"
        >
          {points[points.length - 1].day}
        </text>
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, opacity: 0.7 }}>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "var(--gold, #B8975A)",
              marginRight: 5,
              verticalAlign: "middle",
            }}
          />
          Succès
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: "#E48A8A",
              marginRight: 5,
              verticalAlign: "middle",
            }}
          />
          Échecs
        </span>
      </div>
    </div>
  );
}
