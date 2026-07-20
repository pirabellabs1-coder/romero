import Link from "next/link";
import type { Metadata } from "next";
import { getAgents, AGENT_CATALOG, AgentStatus } from "@/lib/agents";
import HealthPanel from "./HealthPanel";
import OnboardingChecklist from "./OnboardingChecklist";

// Le dashboard admin est un environnement authentifié — pas de cache
// statique. Chaque navigation refetch l'état des agents.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agents IA — Romero Photography",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  not_installed: "À configurer",
  installing: "Configuration",
  installed: "Actif",
  paused: "En pause",
  error: "Erreur",
};

export default async function AgentsIndexPage() {
  // Si la migration SQL n'a pas encore été appliquée, on affiche un
  // message d'aide plutôt qu'une 500. Le photographe peut alors la
  // lancer depuis Supabase avant de revenir.
  let installations: Awaited<ReturnType<typeof getAgents>> = [];
  let migrationError: string | null = null;
  try {
    installations = await getAgents();
  } catch (e) {
    migrationError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      {/* ─── ONBOARDING (masqué dès que tous les agents sont installés) ─── */}
      <OnboardingChecklist />

      {/* ─── LIVE HEALTH PANEL ─── */}
      {/* Nouveau : indicateurs live + sparklines 24 h, auto-refresh 30 s. */}
      <HealthPanel />

      {/* ─── HERO (ancien) — on garde en dessous pour la description ─── */}
      <section className="agents-hero" style={{ marginTop: 6 }}>
        <div className="agents-hero__eyebrow">Écosystème d'agents intelligents</div>
        <h1 className="agents-hero__title">
          Vos <em>agents IA</em>, tous au même endroit
        </h1>
        <p className="agents-hero__lead">
          Un espace unique pour installer, configurer et piloter les quatre agents qui
          automatisent votre communication, votre site, votre agenda et votre
          administratif. Chaque agent est installable indépendamment — commencez par celui
          qui vous apportera le plus de valeur en premier.
        </p>
      </section>

      {migrationError ? (
        <div className="agent-flash agent-flash--err" style={{ marginBottom: 24 }}>
          <strong>Migration DB requise.</strong> La table{" "}
          <code>agent_installations</code> n'existe pas encore. Ouvrez Supabase → SQL
          Editor et exécutez le fichier <code>supabase/schema.sql</code> du repo. Puis
          rafraîchissez cette page.
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
            Détail technique : {migrationError}
          </div>
        </div>
      ) : null}

      {/* ─── GRILLE DES AGENTS ─── */}
      <div className="agents-grid">
        {installations.length === 0 && !migrationError
          ? // fallback : DB accessible mais vide (INSERT initial pas fait)
            Object.values(AGENT_CATALOG)
              .sort((a, b) => a.order - b.order)
              .map((def) => (
                <AgentCard
                  key={def.slug}
                  index={def.order}
                  slug={def.slug}
                  name={def.name}
                  tagline={def.tagline}
                  status="not_installed"
                />
              ))
          : installations.map((inst) => {
              const def = AGENT_CATALOG[inst.slug];
              // Statut dérivé : on ne fait plus confiance au raw DB seul.
              // Si l'agent a une clé API Anthropic et n'est pas en pause
              // ou en erreur, on l'affiche comme actif — même si le flag
              // en base n'a pas encore été flippé (rétro-compatibilité).
              const hasKey = Boolean(
                (inst.config as { anthropic_api_key?: string })?.anthropic_api_key
              );
              const derivedStatus: AgentStatus =
                inst.status === "paused" || inst.status === "error"
                  ? inst.status
                  : hasKey
                  ? "installed"
                  : inst.status;
              return (
                <AgentCard
                  key={inst.slug}
                  index={def.order}
                  slug={inst.slug}
                  name={def.name}
                  tagline={def.tagline}
                  status={derivedStatus}
                />
              );
            })}
      </div>
    </div>
  );
}

function AgentCard(props: {
  index: number;
  slug: string;
  name: string;
  tagline: string;
  status: AgentStatus;
}) {
  const badgeClass = `agent-badge agent-badge--${props.status.replace("_", "-")}`;
  return (
    <article className="agent-card">
      <div className="agent-card__index">
        {String(props.index).padStart(2, "0")}
      </div>
      <h2 className="agent-card__name">{props.name}</h2>
      <p className="agent-card__tagline">{props.tagline}</p>
      <div className="agent-card__meta">
        <span className={badgeClass}>{STATUS_LABEL[props.status]}</span>
        <Link href={`/admin/agents/${props.slug}`} className="agent-card__cta">
          {props.status === "installed"
            ? "Ouvrir"
            : props.status === "paused"
            ? "Reprendre"
            : props.status === "error"
            ? "Diagnostiquer"
            : "Configurer"}
        </Link>
      </div>
    </article>
  );
}
