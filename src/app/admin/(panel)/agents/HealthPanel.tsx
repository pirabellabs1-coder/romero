import Link from "next/link";
import {
  AGENT_CATALOG,
  getAllAgentHealth,
  type AgentHealth,
} from "@/lib/agents";
import AutoRefresh from "./AutoRefresh";

// Auto-refresh : la page se force à re-render toutes les 30 s via
// un `<meta http-equiv="refresh">` conditionnel côté client (dans
// AutoRefresh below). Sur le serveur, on utilise noStore + fetch fresh.
export default async function HealthPanel() {
  let health: AgentHealth[] = [];
  let migrationMissing = false;
  try {
    health = await getAllAgentHealth();
  } catch {
    migrationMissing = true;
  }

  if (migrationMissing) {
    return (
      <div className="agents-hero" style={{ marginBottom: 28 }}>
        <div className="agents-hero__eyebrow">Santé des agents</div>
        <p className="agents-hero__lead">
          Les tables de santé ne sont pas encore présentes. Appliquez la
          migration Supabase pour voir apparaître ce panneau.
        </p>
      </div>
    );
  }

  const totalEvents24h = health.reduce((s, a) => s + a.events_last_24h, 0);
  const liveCount = health.filter((a) => a.is_live).length;
  const allActive = health.every((a) => a.status === "installed");
  const overallSuccessRates = health.filter((a) => a.events_last_24h > 0).map((a) => a.success_rate_24h);
  const avgSuccess = overallSuccessRates.length > 0
    ? Math.round(overallSuccessRates.reduce((s, x) => s + x, 0) / overallSuccessRates.length)
    : 100;

  return (
    <>
      <AutoRefresh />
      {/* En-tête global */}
      <section className="agents-hero" style={{ marginBottom: 28 }}>
        <div className="agents-hero__eyebrow">
          <span className={`live-dot live-dot--${liveCount > 0 ? "live" : "idle"}`} />
          {liveCount > 0
            ? `${liveCount} agent${liveCount > 1 ? "s" : ""} en activité maintenant`
            : "Aucun agent en activité — tout est calme"}
        </div>
        <h1 className="agents-hero__title" style={{ marginBottom: 4 }}>
          Vos <em>agents IA</em>
        </h1>
        <p className="agents-hero__lead">
          {totalEvents24h > 0
            ? `${totalEvents24h.toLocaleString("fr-FR")} événement${totalEvents24h > 1 ? "s" : ""} sur les 24 dernières heures · taux de succès ${avgSuccess}% · ${allActive ? "tous actifs" : "certains agents encore à installer"}.`
            : "Configurez les clés API dans chaque agent pour commencer. La page se rafraîchit toute seule dès qu'il y aura de l'activité."}
        </p>
      </section>

      {/* Grille de mini-cartes santé */}
      <div className="agents-grid" style={{ marginBottom: 26 }}>
        {health.map((h) => (
          <HealthCard key={h.slug} h={h} />
        ))}
      </div>
    </>
  );
}

function HealthCard({ h }: { h: AgentHealth }) {
  const def = AGENT_CATALOG[h.slug];
  const relLastEvent = h.last_event_at ? relativeTime(new Date(h.last_event_at)) : null;
  const isInstalled = h.status === "installed";

  return (
    <Link
      href={`/admin/agents/${h.slug}`}
      className="agent-card"
      style={{ textDecoration: "none", color: "inherit", display: "flex" }}
    >
      <div className="agent-card__index">
        {String(def.order).padStart(2, "0")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          className={`live-dot live-dot--${h.is_live ? "live" : isInstalled ? "idle" : "off"}`}
          aria-hidden
        />
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: h.is_live
              ? "#9DCE9D"
              : isInstalled
              ? "rgba(244,239,227,0.7)"
              : "rgba(244,239,227,0.4)",
          }}
        >
          {h.is_live ? "En activité" : isInstalled ? "Actif" : "Inactif"}
        </span>
      </div>
      <h2 className="agent-card__name" style={{ marginTop: 0 }}>
        {def.name.split(" — ")[0]}
      </h2>
      <p className="agent-card__tagline">{def.tagline}</p>

      {/* Mini KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          padding: "12px 0",
          borderTop: "1px solid rgba(184,151,90,0.18)",
          borderBottom: "1px solid rgba(184,151,90,0.18)",
        }}
      >
        <MiniKPI label="1 h" value={h.events_last_hour} />
        <MiniKPI label="24 h" value={h.events_last_24h} />
        <MiniKPI
          label="Succès"
          value={`${h.success_rate_24h}%`}
          accent={h.success_rate_24h >= 90 ? "ok" : h.success_rate_24h >= 70 ? "warn" : "err"}
        />
      </div>

      {/* Sparkline 24 h */}
      <div style={{ paddingTop: 10 }}>
        <Sparkline buckets={h.hourly_buckets} />
        <div style={{ fontSize: 10, color: "rgba(244,239,227,0.5)", marginTop: 4, letterSpacing: "0.14em" }}>
          Activité 24 h · {relLastEvent ? `dernier événement ${relLastEvent}` : "aucun événement"}
        </div>
      </div>
    </Link>
  );
}

function MiniKPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "ok" | "warn" | "err";
}) {
  const color =
    accent === "ok"
      ? "#9DCE9D"
      : accent === "warn"
      ? "#E0B96A"
      : accent === "err"
      ? "#E48A8A"
      : "var(--gold-light,#D4B57A)";
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--serif, Georgia, serif)",
          fontStyle: "italic",
          fontSize: 22,
          lineHeight: 1,
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(244,239,227,0.55)",
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// SVG sparkline pur : 24 valeurs, échelle auto, aires lissées.
function Sparkline({ buckets }: { buckets: number[] }) {
  const W = 240;
  const H = 36;
  const P = 2;
  const max = Math.max(1, ...buckets);
  const step = (W - P * 2) / Math.max(1, buckets.length - 1);
  const points = buckets
    .map((v, i) => {
      const x = P + i * step;
      const y = P + (H - P * 2) * (1 - v / max);
      return `${x},${y}`;
    })
    .join(" ");
  const area = `M ${P},${H - P} L ${points.split(" ").join(" L ")} L ${W - P},${H - P} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, display: "block" }}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sparkline activité 24 h"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--gold, #B8975A)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--gold, #B8975A)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--gold-light, #D4B57A)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Formatage relatif « il y a X »
function relativeTime(d: Date): string {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 30) return "à l'instant";
  if (diffSec < 60) return `il y a ${diffSec} s`;
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
  if (diffSec < 86400 * 7) return `il y a ${Math.floor(diffSec / 86400)} j`;
  return d.toLocaleDateString("fr-FR");
}
