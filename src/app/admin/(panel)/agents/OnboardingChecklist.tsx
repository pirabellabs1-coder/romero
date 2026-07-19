import Link from "next/link";
import { AGENT_CATALOG, getAgents, type AgentInstallation } from "@/lib/agents";
import { query } from "@/lib/db";

/**
 * Panneau « Bien démarrer » affiché sur /admin/agents.
 * ────────────────────────────────────────────────────
 * Ne s'affiche que si au moins un agent n'est pas encore activé.
 * Dès que les 4 agents sont installés, le panneau disparaît.
 *
 * Pour chaque agent, on affiche 4 étapes cliquables :
 * ①  Configuration API — clé Claude renseignée
 * ②  Base de connaissances — au moins 1 fiche
 * ③  Test — au moins 1 exécution playground
 * ④  Activation — statut passé à « installed »
 *
 * Chaque étape terminée est cochée. La suivante est mise en évidence.
 * Objectif : Mickael sait toujours quelle est sa prochaine action.
 */
export default async function OnboardingChecklist() {
  let installations: AgentInstallation[] = [];
  try {
    installations = await getAgents();
  } catch {
    return null; // migration pas encore appliquée — géré ailleurs
  }

  // On ne montre l'onboarding que si tous les agents ne sont pas actifs.
  const allInstalled = installations.every((i) => i.status === "installed");
  if (allInstalled) return null;

  // Récupère en une requête les compteurs KB + tests par agent.
  type Row = { agent_slug: string; kb: number; tested: number };
  const rows = await query<Row>(
    `SELECT
       s.slug AS agent_slug,
       COALESCE(k.n, 0)::int AS kb,
       COALESCE(t.n, 0)::int AS tested
     FROM (SELECT unnest($1::text[]) AS slug) s
     LEFT JOIN (
       SELECT agent_slug, COUNT(*) AS n
       FROM agent_knowledge GROUP BY agent_slug
     ) k ON k.agent_slug = s.slug
     LEFT JOIN (
       SELECT agent_slug, COUNT(*) AS n
       FROM agent_test_messages GROUP BY agent_slug
     ) t ON t.agent_slug = s.slug`,
    [["site", "whatsapp", "marketing", "admin"]]
  ).catch(() => [] as Row[]);
  const kbBySlug = new Map(rows.map((r) => [r.agent_slug, r]));

  // Calcule la progression globale (utile pour un badge de tête)
  const totalSteps = installations.length * 4;
  let doneSteps = 0;
  const perAgent = installations.map((inst) => {
    const def = AGENT_CATALOG[inst.slug];
    const counts = kbBySlug.get(inst.slug) || { kb: 0, tested: 0 };
    const cfg = (inst.config ?? {}) as Record<string, string>;
    const steps = [
      {
        label: "Clé Claude renseignée",
        done: Boolean(cfg.anthropic_api_key),
        href: `/admin/agents/${inst.slug}?tab=config`,
      },
      {
        label: "Base de connaissances alimentée",
        done: counts.kb > 0,
        href: `/admin/agents/${inst.slug}?tab=knowledge`,
      },
      {
        label: "Testé au moins une fois",
        done: counts.tested > 0,
        href: `/admin/agents/${inst.slug}?tab=playground`,
      },
      {
        label: "Agent activé",
        done: inst.status === "installed",
        href: `/admin/agents/${inst.slug}?tab=config`,
      },
    ];
    doneSteps += steps.filter((s) => s.done).length;
    // Trouve la prochaine étape à faire (première non-done)
    const nextStep = steps.findIndex((s) => !s.done);
    return { inst, def, steps, nextStep };
  });

  const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <section className="onboarding-panel">
      {/* Header */}
      <div className="onboarding-header">
        <div>
          <div className="onboarding-eyebrow">Bien démarrer</div>
          <h2 className="onboarding-title">
            {doneSteps === 0
              ? "Prêt à activer votre premier agent ?"
              : "Progression de l'installation"}
          </h2>
        </div>
        <div className="onboarding-progress">
          <div className="onboarding-progress__label">
            {doneSteps}/{totalSteps} étapes
          </div>
          <div className="onboarding-progress__bar">
            <div
              className="onboarding-progress__fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grille agents avec 4 étapes chacun */}
      <div className="onboarding-agents">
        {perAgent.map(({ inst, def, steps, nextStep }) => {
          const allDone = steps.every((s) => s.done);
          return (
            <div
              key={inst.slug}
              className={`onboarding-agent ${allDone ? "onboarding-agent--done" : ""}`}
            >
              <div className="onboarding-agent__head">
                <span className="onboarding-agent__num">
                  {String(def.order).padStart(2, "0")}
                </span>
                <span className="onboarding-agent__name">
                  {def.name.split(" — ")[0]}
                </span>
                {allDone ? (
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#9DCE9D",
                      marginLeft: "auto",
                    }}
                  >
                    ✓ Prêt
                  </span>
                ) : null}
              </div>
              <ol className="onboarding-agent__steps">
                {steps.map((step, i) => (
                  <li
                    key={i}
                    data-done={step.done ? "1" : "0"}
                    data-next={i === nextStep ? "1" : "0"}
                  >
                    <Link
                      href={step.href}
                      className="onboarding-step__link"
                    >
                      <span className="onboarding-step__marker">
                        {step.done ? "✓" : i + 1}
                      </span>
                      <span className="onboarding-step__label">
                        {step.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
