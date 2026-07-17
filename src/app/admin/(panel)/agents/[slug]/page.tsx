import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AGENT_CATALOG,
  AGENT_ORDER,
  AgentSlug,
  getAgent,
} from "@/lib/agents";
import AgentConfigForm from "./AgentConfigForm";
import AgentStatusControls from "./AgentStatusControls";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug: string };
  searchParams?: { ok?: string; err?: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const def = AGENT_CATALOG[params.slug as AgentSlug];
  if (!def) return { title: "Agent — Romero Photography" };
  return { title: `${def.name} — Romero Photography` };
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: PageProps) {
  if (!AGENT_ORDER.includes(params.slug as AgentSlug)) notFound();
  const slug = params.slug as AgentSlug;
  const def = AGENT_CATALOG[slug];

  // Si la table n'existe pas encore, on reste utilisable : on affiche
  // les infos catalogue en lecture seule et un message de migration.
  let installation: Awaited<ReturnType<typeof getAgent>> = null;
  let migrationError: string | null = null;
  try {
    installation = await getAgent(slug);
  } catch (e) {
    migrationError = e instanceof Error ? e.message : String(e);
  }

  const config = (installation?.config ?? {}) as Record<string, string>;
  const status = installation?.status ?? "not_installed";

  return (
    <div>
      <Link href="/admin/agents" className="agent-back">
        ← Retour aux agents
      </Link>

      {/* Hero réduit — le contexte est déjà donné par la landing */}
      <section className="agents-hero" style={{ marginBottom: 28, padding: "32px 34px" }}>
        <div className="agents-hero__eyebrow">
          Agent 0{def.order} · {status === "installed" ? "Installé" : "Installation"}
        </div>
        <h1 className="agents-hero__title" style={{ fontSize: "clamp(26px, 3vw, 34px)" }}>
          {def.name.split(" — ")[0]}
          <em style={{ display: "block", fontSize: "0.7em", marginTop: 4 }}>
            {def.name.split(" — ")[1] ?? def.tagline}
          </em>
        </h1>
        <p className="agents-hero__lead">{def.description}</p>
      </section>

      {searchParams?.ok ? (
        <div className="agent-flash agent-flash--ok">
          ✓ Modifications enregistrées.
        </div>
      ) : null}
      {searchParams?.err ? (
        <div className="agent-flash agent-flash--err">
          ✗ {decodeURIComponent(searchParams.err)}
        </div>
      ) : null}
      {migrationError ? (
        <div className="agent-flash agent-flash--err">
          <strong>Migration DB requise.</strong> Exécutez{" "}
          <code>supabase/schema.sql</code> sur Supabase, puis rafraîchissez.
        </div>
      ) : null}

      <div className="agent-detail">
        {/* ─── Colonne gauche : formulaire de configuration ─── */}
        <div className="agent-panel">
          <h2>Configuration</h2>
          <p style={{ marginTop: -8, marginBottom: 20 }}>
            Renseignez les identifiants et paramètres nécessaires. Les valeurs sont
            chiffrées au repos côté base de données.
          </p>
          <AgentConfigForm slug={slug} fields={def.configFields} current={config} />
        </div>

        {/* ─── Colonne droite : étapes + statut ─── */}
        <div>
          <div className="agent-panel" style={{ marginBottom: 22 }}>
            <h2>Étapes d'installation</h2>
            <ol className="agent-steps">
              {def.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          <div className="agent-panel">
            <h2>Statut</h2>
            <p style={{ marginTop: -8, marginBottom: 16 }}>
              {status === "installed"
                ? "L'agent est actif et opérationnel."
                : status === "paused"
                ? "L'agent est temporairement désactivé."
                : status === "installing"
                ? "Installation en cours…"
                : status === "error"
                ? "Une erreur est survenue lors de la dernière opération."
                : "L'agent n'est pas encore actif."}
            </p>
            <AgentStatusControls slug={slug} status={status} />
          </div>
        </div>
      </div>
    </div>
  );
}
