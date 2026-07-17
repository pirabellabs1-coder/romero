import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AGENT_CATALOG,
  AGENT_ORDER,
  AgentSlug,
  effectivePrompt,
  getAgent,
  getStats,
  listEvents,
  listKnowledge,
  listTestMessages,
} from "@/lib/agents";
import { DEFAULT_PROMPTS } from "@/lib/agent-prompts";
import AgentConfigForm from "./AgentConfigForm";
import AgentStatusControls from "./AgentStatusControls";
import PromptEditor from "./PromptEditor";
import KnowledgeManager from "./KnowledgeManager";
import Playground from "./Playground";
import StatsView from "./StatsView";
import ActivityFeed from "./ActivityFeed";
import OverviewTab from "./OverviewTab";
import ConversationsView from "./ConversationsView";

export const dynamic = "force-dynamic";

type Tab =
  | "overview"
  | "config"
  | "prompt"
  | "knowledge"
  | "playground"
  | "conversations"
  | "stats"
  | "activity";
const TAB_LABEL: Record<Tab, string> = {
  overview: "Aperçu",
  config: "Configuration",
  prompt: "Entraînement",
  knowledge: "Connaissances",
  playground: "Test",
  conversations: "Conversations",
  stats: "Statistiques",
  activity: "Activité",
};
// L'onglet Conversations n'existe que pour l'agent 'site' (les autres
// agents auront leur propre onglet spécialisé plus tard).
function tabsFor(slug: AgentSlug): Tab[] {
  const base: Tab[] = ["overview", "config", "prompt", "knowledge", "playground"];
  if (slug === "site") base.push("conversations");
  base.push("stats", "activity");
  return base;
}

function normalizeTab(raw: string | undefined, allowed: Tab[]): Tab {
  if (raw && (allowed as string[]).includes(raw)) return raw as Tab;
  return "overview";
}

type PageProps = {
  params: { slug: string };
  searchParams?: { tab?: string; ok?: string; err?: string; conv?: string };
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
  const availableTabs = tabsFor(slug);
  const tab = normalizeTab(searchParams?.tab, availableTabs);
  const convId = searchParams?.conv ? Number(searchParams.conv) : undefined;

  // On tolère le cas « migration pas encore jouée » : chaque appel est
  // try/catch pour ne pas casser toute la page si UNE table manque.
  let installation: Awaited<ReturnType<typeof getAgent>> = null;
  let migrationError: string | null = null;
  try {
    installation = await getAgent(slug);
  } catch (e) {
    migrationError = e instanceof Error ? e.message : String(e);
  }

  const status = installation?.status ?? "not_installed";
  const config = (installation?.config ?? {}) as Record<string, string>;
  const currentPrompt =
    installation?.system_prompt && installation.system_prompt.trim().length > 0
      ? installation.system_prompt
      : DEFAULT_PROMPTS[slug];

  return (
    <div>
      <Link href="/admin/agents" className="agent-back">
        ← Retour aux agents
      </Link>

      {/* ── Hero réduit ── */}
      <section className="agents-hero" style={{ marginBottom: 24, padding: "28px 32px" }}>
        <div className="agents-hero__eyebrow">
          Agent 0{def.order} · {status === "installed" ? "Actif" : "En installation"}
        </div>
        <h1 className="agents-hero__title" style={{ fontSize: "clamp(24px, 2.8vw, 32px)" }}>
          {def.name.split(" — ")[0]}
          <em style={{ display: "block", fontSize: "0.72em", marginTop: 4 }}>
            {def.name.split(" — ")[1] ?? def.tagline}
          </em>
        </h1>
      </section>

      {/* ── Tabs ── */}
      <nav className="agent-tabs" role="tablist">
        {availableTabs.map((t) => (
          <Link
            key={t}
            role="tab"
            aria-selected={tab === t}
            href={`/admin/agents/${slug}?tab=${t}`}
            className={`agent-tab ${tab === t ? "agent-tab--active" : ""}`}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </nav>

      {/* ── Flash messages ── */}
      {searchParams?.ok ? (
        <div className="agent-flash agent-flash--ok">✓ Modifications enregistrées.</div>
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
          <div style={{ marginTop: 6, opacity: 0.6, fontSize: 12 }}>{migrationError}</div>
        </div>
      ) : null}

      {/* ── Contenu du tab ── */}
      {tab === "overview" ? (
        <OverviewTab slug={slug} def={def} installation={installation} />
      ) : null}

      {tab === "config" ? (
        <div className="agent-detail">
          <div className="agent-panel">
            <h2>Configuration technique</h2>
            <p style={{ marginTop: -8, marginBottom: 20 }}>
              Identifiants et paramètres nécessaires au fonctionnement de l'agent.
            </p>
            <AgentConfigForm
              slug={slug}
              fields={def.configFields}
              current={config}
            />
          </div>
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
      ) : null}

      {tab === "prompt" ? (
        <PromptEditor
          slug={slug}
          current={currentPrompt}
          isDefault={
            !installation?.system_prompt ||
            installation.system_prompt.trim().length === 0
          }
          defaultPrompt={DEFAULT_PROMPTS[slug]}
        />
      ) : null}

      {tab === "knowledge" ? (
        <KnowledgeTabWrapper slug={slug} />
      ) : null}

      {tab === "playground" ? (
        <PlaygroundTabWrapper slug={slug} />
      ) : null}

      {tab === "conversations" && slug === "site" ? (
        <ConversationsView activeConvId={convId} />
      ) : null}

      {tab === "stats" ? <StatsTabWrapper slug={slug} /> : null}

      {tab === "activity" ? <ActivityTabWrapper slug={slug} /> : null}
    </div>
  );
}

// ── Wrappers server-side qui chargent la data et passent au client component
async function KnowledgeTabWrapper({ slug }: { slug: AgentSlug }) {
  const entries = await listKnowledge(slug).catch(() => []);
  return <KnowledgeManager slug={slug} entries={entries} />;
}

async function PlaygroundTabWrapper({ slug }: { slug: AgentSlug }) {
  const history = await listTestMessages(slug, 10).catch(() => []);
  return <Playground slug={slug} history={history} />;
}

async function StatsTabWrapper({ slug }: { slug: AgentSlug }) {
  const stats = await getStats(slug).catch(() => ({
    total_events: 0,
    success_events: 0,
    failure_events: 0,
    by_type: [],
    daily: [],
  }));
  return <StatsView stats={stats} />;
}

async function ActivityTabWrapper({ slug }: { slug: AgentSlug }) {
  const events = await listEvents(slug, 100).catch(() => []);
  return <ActivityFeed events={events} />;
}
