/* Pure SVG charts — no external dependency, server-rendered, accessible */

type BarDatum = { label: string; value: number };

export function BarChart({ data, title, color = "var(--gold)", height = 200, maxLabels = 12 }: { data: BarDatum[]; title?: string; color?: string; height?: number; maxLabels?: number }) {
  if (data.length === 0) {
    return <EmptyState message="Pas encore de données." />;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100; // viewBox width (responsive via CSS)
  const padBottom = 22;
  const padTop = 12;
  const innerH = height - padBottom - padTop;
  const barW = (w - 6) / data.length;
  const labelStride = Math.max(1, Math.ceil(data.length / maxLabels));

  return (
    <div style={{ width: "100%" }}>
      {title && <div className="cap-tracked-sm" style={{ color: "var(--muted)", marginBottom: 10 }}>{title}</div>}
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block" }} aria-label={title}>
        {/* Baseline */}
        <line x1="0" y1={height - padBottom} x2={w} y2={height - padBottom} stroke="var(--rule)" strokeWidth="0.3" />
        {/* Grid lines (3 horizontal) */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1="0" y1={padTop + innerH * (1 - p)} x2={w} y2={padTop + innerH * (1 - p)} stroke="var(--rule)" strokeWidth="0.15" strokeDasharray="0.6 0.6" />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = 3 + i * barW + barW * 0.12;
          const bw = barW * 0.76;
          const y = padTop + innerH - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={h} fill={color} rx="0.3">
                <title>{`${d.label}: ${d.value}`}</title>
              </rect>
              {d.value > 0 && (
                <text x={x + bw / 2} y={y - 1.5} fontSize="2.4" textAnchor="middle" fill="var(--muted)" fontFamily="var(--sans)">{d.value}</text>
              )}
            </g>
          );
        })}
        {/* X labels (subset) */}
        {data.map((d, i) =>
          i % labelStride === 0 ? (
            <text key={"l" + i} x={3 + i * barW + barW / 2} y={height - 8} fontSize="2.6" textAnchor="middle" fill="var(--muted)" fontFamily="var(--sans)">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export function HBarChart({ data, title, color = "var(--gold)" }: { data: BarDatum[]; title?: string; color?: string }) {
  if (data.length === 0) return <EmptyState message="Pas encore de données." />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ width: "100%" }}>
      {title && <div className="cap-tracked-sm" style={{ color: "var(--muted)", marginBottom: 12 }}>{title}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={d.label} style={{ display: "grid", gridTemplateColumns: "140px 1fr 36px", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 12.5, color: "var(--forest)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>{d.label}</div>
              <div style={{ height: 10, background: "var(--cream-deep)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width .6s ease" }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", fontFamily: "var(--sans)" }}>{d.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Donut({ data, title, total: explicitTotal, palette = ["#B8975A", "#9DB29A", "#2E3D2E", "#C2A878", "#B98B86"] }: { data: BarDatum[]; title?: string; total?: number; palette?: string[] }) {
  const total = explicitTotal ?? data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyState message="Pas encore de données." />;
  const size = 160;
  const r = 64;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = data.map((d, i) => {
    const frac = d.value / total;
    const len = circ * frac;
    const arc = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="transparent"
        stroke={palette[i % palette.length]}
        strokeWidth="22"
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      >
        <title>{`${d.label}: ${d.value} (${Math.round(frac * 100)}%)`}</title>
      </circle>
    );
    offset += len;
    return arc;
  });

  return (
    <div>
      {title && <div className="cap-tracked-sm" style={{ color: "var(--muted)", marginBottom: 14 }}>{title}</div>}
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="var(--cream-deep)" strokeWidth="22" />
          {arcs}
          <text x={cx} y={cy - 2} fontSize="22" textAnchor="middle" dominantBaseline="middle" fill="var(--forest)" fontFamily="var(--serif)" fontWeight="500">
            {total}
          </text>
          <text x={cx} y={cy + 14} fontSize="7" textAnchor="middle" fill="var(--muted)" fontFamily="var(--sans)" letterSpacing="0.18em">TOTAL</text>
        </svg>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 120 }}>
          {data.map((d, i) => (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ width: 12, height: 12, background: palette[i % palette.length], borderRadius: 3, flexShrink: 0 }} />
              <span style={{ color: "var(--forest)", flex: 1 }}>{d.label}</span>
              <span style={{ color: "var(--muted)" }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 18px",
        background: "var(--cream)",
        border: "1px dashed var(--rule)",
        borderRadius: 6,
        color: "var(--muted)",
        fontSize: 13,
        fontStyle: "italic",
      }}
    >
      {message}
    </div>
  );
}
