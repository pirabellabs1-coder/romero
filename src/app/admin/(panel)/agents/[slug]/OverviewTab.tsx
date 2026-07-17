import Link from "next/link";
import {
  AgentInstallation,
  AgentSlug,
  getStats,
  listEvents,
  listKnowledge,
  listTestMessages,
} from "@/lib/agents";
import type { AgentDef } from "@/lib/agents";

type Props = {
  slug: AgentSlug;
  def: AgentDef;
  installation: AgentInstallation | null;
};

export default async function OverviewTab({ slug, def, installation }: Props) {
  const [stats, events, kb, tests] = await Promise.all([
    getStats(slug).catch(() => null),
    listEvents(slug, 5).catch(() => []),
    listKnowledge(slug).catch(() => []),
    listTestMessages(slug, 5).catch(() => []),
  ]);

  const readiness = computeReadiness(installation, kb.length);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 24 }} className="agent-overview">
      <div>
        {/* Description */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2>À propos de cet agent</h2>
          <p>{def.description}</p>
        </div>

        {/* Étapes cochées / à faire */}
        <div className="agent-panel">
          <h2>Progression de l'installation</h2>
          <div className="agent-readiness">
            <div className="agent-readiness__bar">
              <div
                className="agent-readiness__fill"
                style={{ width: `${readiness.pct}%` }}
              />
            </div>
            <div className="agent-readiness__label">
              {readiness.pct}% — {readiness.done}/{readiness.total} étapes clés
            </div>
          </div>
          <ol className="agent-readiness__list">
            {readiness.items.map((it, i) => (
              <li key={i} data-done={it.done ? "1" : "0"}>
                <span className="agent-readiness__check" aria-hidden>
                  {it.done ? "✓" : "○"}
                </span>
                {it.label}
                {it.cta ? (
                  <Link href={it.cta.href} className="agent-readiness__cta">
                    {it.cta.label} →
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div>
        {/* Mini-stats */}
        <div className="agent-panel" style={{ marginBottom: 22 }}>
          <h2>Chiffres clés</h2>
          <div className="agent-kpi-grid">
            <KPI label="Événements" value={stats?.total_events ?? 0} />
            <KPI label="Succès" value={stats?.success_events ?? 0} accent="ok" />
            <KPI label="Erreurs" value={stats?.failure_events ?? 0} accent={stats && stats.failure_events > 0 ? "err" : "muted"} />
            <KPI label="Connaissances" value={kb.length} />
            <KPI label="Tests" value={tests.length} />
            <KPI
              label="Statut"
              value={
                installation?.status === "installed"
                  ? "Actif"
                  : installation?.status === "paused"
                  ? "Pause"
                  : "Inactif"
              }
              accent={installation?.status === "installed" ? "ok" : "muted"}
            />
          </div>
        </div>

        {/* Derniers événements */}
        <div className="agent-panel">
          <h2>Activité récente</h2>
          {events.length === 0 ? (
            <p style={{ opacity: 0.6 }}>Aucun événement enregistré pour le moment.</p>
          ) : (
            <ul className="agent-recent-list">
              {events.map((e) => (
                <li key={e.id}>
                  <span
                    className={`agent-badge agent-badge--${e.success ? "installed" : "error"}`}
                    style={{ padding: "3px 8px", fontSize: 9 }}
                  >
                    {e.event_type}
                  </span>
                  <span className="agent-recent-list__time">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/admin/agents/${slug}?tab=activity`}
            className="agent-btn agent-btn--ghost"
            style={{ marginTop: 14 }}
          >
            Voir tout →
          </Link>
        </div>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "ok" | "err" | "muted";
}) {
  return (
    <div className={`agent-kpi agent-kpi--${accent ?? "default"}`}>
      <div className="agent-kpi__value">{value}</div>
      <div className="agent-kpi__label">{label}</div>
    </div>
  );
}

// Heuristique simple qui devine si l'agent est « prêt à tourner ».
// Le photographe voit une barre de progression et les étapes qui
// restent, chacune cliquable vers l'onglet concerné.
function computeReadiness(
  inst: AgentInstallation | null,
  kbCount: number
): {
  pct: number;
  done: number;
  total: number;
  items: Array<{
    label: string;
    done: boolean;
    cta?: { href: string; label: string };
  }>;
} {
  const slug = inst?.slug ?? "site";
  const config = (inst?.config ?? {}) as Record<string, string>;
  const hasKey = Boolean(config.anthropic_api_key);
  const hasPrompt = Boolean(inst?.system_prompt && inst.system_prompt.trim());
  const hasKb = kbCount > 0;
  const isInstalled = inst?.status === "installed";

  const items = [
    {
      label: "Clé API Anthropic renseignée",
      done: hasKey,
      cta: hasKey ? undefined : { href: `/admin/agents/${slug}?tab=config`, label: "Configurer" },
    },
    {
      label: "Prompt système personnalisé",
      done: hasPrompt,
      cta: hasPrompt ? undefined : { href: `/admin/agents/${slug}?tab=prompt`, label: "Éditer" },
    },
    {
      label: "Base de connaissances alimentée",
      done: hasKb,
      cta: hasKb ? undefined : { href: `/admin/agents/${slug}?tab=knowledge`, label: "Ajouter" },
    },
    {
      label: "Testé au moins une fois",
      done: (inst && (inst as unknown as { tested?: boolean }).tested) === true ? true : false,
      cta: { href: `/admin/agents/${slug}?tab=playground`, label: "Tester" },
    },
    {
      label: "Agent activé",
      done: isInstalled,
      cta: isInstalled ? undefined : { href: `/admin/agents/${slug}?tab=config`, label: "Activer" },
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { pct: Math.round((done / items.length) * 100), done, total: items.length, items };
}
