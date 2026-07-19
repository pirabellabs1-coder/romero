import type { AgentStats } from "@/lib/agents";

type Props = {
  stats: AgentStats;
  hourly?: number[]; // 24 buckets (0 = il y a 23 h, 23 = maintenant)
  latency?: Array<{ bucket_ms: number; count: number }>;
};

// SVG pur pour tous les graphes — pas de dépendance externe. Le style
// suit la charte : gold sur fond forest sombre, rouge pour les erreurs,
// vert menthe pour le succès.
export default function StatsView({ stats, hourly, latency }: Props) {
  const successRate =
    stats.total_events > 0
      ? Math.round((stats.success_events / stats.total_events) * 100)
      : 100;

  return (
    <div className="agent-detail">
      <div style={{ gridColumn: "1 / -1" }}>
        {/* KPIs synthèse */}
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
            <div
              className={`agent-kpi agent-kpi--${
                stats.failure_events > 0 ? "err" : "muted"
              }`}
            >
              <div className="agent-kpi__value">{stats.failure_events}</div>
              <div className="agent-kpi__label">Erreurs</div>
            </div>
            <div
              className={`agent-kpi agent-kpi--${
                successRate >= 90 ? "ok" : successRate >= 70 ? "default" : "err"
              }`}
            >
              <div className="agent-kpi__value">{successRate}%</div>
              <div className="agent-kpi__label">Taux de succès</div>
            </div>
          </div>
        </div>

        {/* Row 1 : donut succès + histogramme latence */}
        <div className="stats-grid">
          <div className="stats-card">
            <h3>Taux de succès (30 j)</h3>
            <SuccessDonut
              success={stats.success_events}
              failure={stats.failure_events}
            />
          </div>

          <div className="stats-card">
            <h3>Latence des tests (7 j)</h3>
            <LatencyHistogram data={latency ?? []} />
          </div>
        </div>

        {/* Timeline 24 h en heure-par-heure */}
        {hourly && hourly.length === 24 ? (
          <div className="stats-card" style={{ marginBottom: 22 }}>
            <h3>Activité — dernières 24 heures</h3>
            <HourlyBars buckets={hourly} />
          </div>
        ) : null}

        {/* Timeline 30 j (déjà existant, on garde) */}
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
              généré, contrat signé, etc.) apparaîtra ici classée par type.
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

// ─── Donut de taux de succès ─────────────────────────────────────
function SuccessDonut({
  success,
  failure,
}: {
  success: number;
  failure: number;
}) {
  const total = success + failure;
  const rate = total > 0 ? success / total : 1;
  const CX = 90;
  const CY = 90;
  const R = 66;
  const STROKE = 22;
  const CIRC = 2 * Math.PI * R;
  const okLen = CIRC * rate;
  const errLen = CIRC * (1 - rate);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <svg viewBox="0 0 180 180" width={180} height={180} role="img" aria-label="Taux de succès">
        {/* Fond gris */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(184,151,90,0.16)"
          strokeWidth={STROKE}
        />
        {/* Segment erreur (rouge) */}
        {failure > 0 ? (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="#E48A8A"
            strokeWidth={STROKE}
            strokeDasharray={`${errLen} ${CIRC}`}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ) : null}
        {/* Segment succès (vert menthe) */}
        {success > 0 ? (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="#9DCE9D"
            strokeWidth={STROKE}
            strokeDasharray={`${okLen} ${CIRC}`}
            transform={`rotate(${-90 + 360 * (1 - rate)} ${CX} ${CY})`}
          />
        ) : null}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          className="stats-donut-center"
          fill="#F4EFE3"
          fontSize="36"
        >
          {total > 0 ? Math.round(rate * 100) : 100}%
        </text>
        <text
          x={CX}
          y={CY + 18}
          textAnchor="middle"
          fill="rgba(244,239,227,0.55)"
          fontSize="10"
          letterSpacing="2"
        >
          SUCCÈS
        </text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: "#9DCE9D",
              display: "inline-block",
              borderRadius: 2,
            }}
          />
          <span style={{ fontSize: 12.5, color: "rgba(244,239,227,0.85)" }}>
            {success.toLocaleString("fr-FR")} succès
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              background: "#E48A8A",
              display: "inline-block",
              borderRadius: 2,
            }}
          />
          <span style={{ fontSize: 12.5, color: "rgba(244,239,227,0.85)" }}>
            {failure.toLocaleString("fr-FR")} erreurs
          </span>
        </div>
        {total === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "rgba(244,239,227,0.5)",
              fontStyle: "italic",
              marginTop: 6,
            }}
          >
            Pas encore d'événement — le donut se remplira dès la première activité.
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Histogramme des latences ────────────────────────────────────
function LatencyHistogram({
  data,
}: {
  data: Array<{ bucket_ms: number; count: number }>;
}) {
  // Buckets fixes : 500, 1000, 2000, 4000, 8000
  const LABELS: Record<number, string> = {
    500: "< 0,5 s",
    1000: "0,5–1 s",
    2000: "1–2 s",
    4000: "2–4 s",
    8000: "> 4 s",
  };
  const buckets = [500, 1000, 2000, 4000, 8000];
  const map = new Map(data.map((d) => [d.bucket_ms, d.count]));
  const values = buckets.map((b) => map.get(b) ?? 0);
  const max = Math.max(1, ...values);

  const W = 360;
  const H = 160;
  const P = 20;
  const barW = (W - P * 2) / buckets.length - 8;

  if (values.every((v) => v === 0)) {
    return (
      <p style={{ opacity: 0.55, fontStyle: "italic", fontSize: 13.5, margin: 0 }}>
        Aucun test dans les 7 derniers jours. Lancez un test dans l'onglet Test
        pour alimenter cet histogramme.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 30}`}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label="Histogramme des latences"
    >
      {values.map((v, i) => {
        const x = P + i * (barW + 8);
        const h = (H - P) * (v / max);
        const y = H - h;
        return (
          <g key={buckets[i]}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill={buckets[i] <= 1000 ? "#9DCE9D" : buckets[i] <= 4000 ? "var(--gold, #B8975A)" : "#E48A8A"}
              opacity={0.85}
            />
            <text
              x={x + barW / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(244,239,227,0.75)"
            >
              {v}
            </text>
            <text
              x={x + barW / 2}
              y={H + 18}
              textAnchor="middle"
              fontSize="9.5"
              fill="rgba(244,239,227,0.55)"
              letterSpacing="1"
            >
              {LABELS[buckets[i]]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Barres horaires 24 h ────────────────────────────────────────
function HourlyBars({ buckets }: { buckets: number[] }) {
  const W = 720;
  const H = 140;
  const P = 20;
  const max = Math.max(1, ...buckets);
  const barW = (W - P * 2) / buckets.length - 2;

  const allZero = buckets.every((v) => v === 0);
  if (allZero) {
    return (
      <p style={{ opacity: 0.55, fontStyle: "italic", fontSize: 13.5, margin: 0 }}>
        Rien reçu ces 24 dernières heures. Cette timeline s'anime dès qu'un
        visiteur ou un canal externe déclenche un événement.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H + 30}`}
        style={{ width: "100%", minWidth: 600, height: "auto" }}
        role="img"
        aria-label="Timeline horaire 24 h"
      >
        {/* Grille */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={P}
            x2={W - P}
            y1={P + (H - P) * (1 - t)}
            y2={P + (H - P) * (1 - t)}
            stroke="rgba(184,151,90,0.12)"
            strokeWidth={0.5}
          />
        ))}
        {buckets.map((v, i) => {
          const x = P + i * (barW + 2);
          const h = (H - P) * (v / max);
          const y = P + (H - P) - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={1.5}
              fill="var(--gold, #B8975A)"
              opacity={0.9}
            />
          );
        })}
        <text x={P} y={H + 22} fontSize="10" fill="rgba(244,239,227,0.55)">
          il y a 23 h
        </text>
        <text
          x={W - P}
          y={H + 22}
          fontSize="10"
          fill="rgba(244,239,227,0.55)"
          textAnchor="end"
        >
          maintenant
        </text>
      </svg>
    </div>
  );
}

// ─── Barres quotidiennes 30 j ────────────────────────────────────
function DailyBars({
  daily,
}: {
  daily: Array<{ day: string; count: number; success: number }>;
}) {
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
      >
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
        {points.map((p, i) => {
          const x = P + i * (barW + 2);
          const totalH = (H - P * 2) * (p.count / max);
          const okH = (H - P * 2) * (p.success / max);
          const failH = totalH - okH;
          return (
            <g key={p.day}>
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
