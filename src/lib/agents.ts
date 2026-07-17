import { unstable_noStore as noStore } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { DEFAULT_PROMPTS } from "@/lib/agent-prompts";

// ─── Types ──────────────────────────────────────────────────────────────
export type AgentSlug = "site" | "whatsapp" | "marketing" | "admin";

export type AgentStatus =
  | "not_installed"
  | "installing"
  | "installed"
  | "error"
  | "paused";

export type AgentInstallation = {
  slug: AgentSlug;
  name: string;
  status: AgentStatus;
  config: Record<string, unknown>;
  system_prompt: string;
  installed_at: string | null;
  updated_at: string;
};

export type AgentKnowledgeEntry = {
  id: number;
  agent_slug: AgentSlug;
  title: string;
  content: string;
  category: string;
  updated_at: string;
  created_at: string;
};

export type AgentEvent = {
  id: number;
  agent_slug: AgentSlug;
  event_type: string;
  payload: Record<string, unknown>;
  success: boolean;
  created_at: string;
};

export type AgentTestMessage = {
  id: number;
  agent_slug: AgentSlug;
  input_text: string;
  output_text: string;
  prompt_snapshot: string;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
};

// ─── Catalog (source de vérité pour l'UI, indépendant de la DB) ─────────
// Description, étapes d'installation, champs de config attendus, ordre
// d'affichage. La DB ne stocke que l'état ; ce module contient la
// description marketing/fonctionnelle qui varie au fil des itérations.
export type AgentDef = {
  slug: AgentSlug;
  name: string;
  tagline: string;
  description: string;
  order: number;
  steps: string[];
  configFields: Array<{
    key: string;
    label: string;
    type: "text" | "password" | "textarea" | "url";
    placeholder?: string;
    help?: string;
    required?: boolean;
  }>;
};

export const AGENT_CATALOG: Record<AgentSlug, AgentDef> = {
  site: {
    slug: "site",
    name: "Agent site — chatbot & prise de RDV",
    tagline: "Répond aux visiteurs, qualifie les prospects, prend les rendez-vous.",
    description:
      "Chatbot Claude qui connaît vos prestations, tarifs et univers. Il qualifie chaque visiteur (budget, date, lieu, style), propose des créneaux depuis votre agenda, et vous envoie un e-mail récapitulatif complet à chaque prise de rendez-vous.",
    order: 1,
    steps: [
      "Ingestion de la base de connaissances (prestations, tarifs, FAQ)",
      "Connexion à Google Calendar / Cal.com",
      "Configuration du webhook e-mail récapitulatif",
      "Personnalisation du prompt système",
      "Publication du widget sur le site",
    ],
    configFields: [
      { key: "anthropic_api_key", label: "Clé API Anthropic (Claude)", type: "password", required: true, help: "Créée sur console.anthropic.com" },
      { key: "calendar_provider", label: "Fournisseur d'agenda", type: "text", placeholder: "google | calcom", required: true },
      { key: "calendar_url", label: "URL / ID de l'agenda", type: "url", placeholder: "https://cal.com/mickael-romero/consultation" },
      { key: "notification_email", label: "E-mail de notification", type: "text", placeholder: "romerophotography.contact@gmail.com", required: true },
      { key: "system_prompt", label: "Prompt système (ton, style, limites)", type: "textarea", placeholder: "Tu es l'assistant virtuel de Mickael Romero…" },
    ],
  },
  whatsapp: {
    slug: "whatsapp",
    name: "Assistant WhatsApp + Agenda",
    tagline: "Un vocal WhatsApp = un rendez-vous créé dans votre calendrier.",
    description:
      "Assistant personnel accessible depuis WhatsApp et Claude Desktop via un serveur MCP unique. Il comprend les vocaux, crée / modifie / consulte vos événements Google Calendar, et vous répond en langage naturel.",
    order: 2,
    steps: [
      "Validation Meta WhatsApp Business (ou Twilio en fallback)",
      "OAuth Google Calendar",
      "Déploiement du serveur MCP",
      "Configuration Telegram fallback (le temps de la validation Meta)",
      "Test end-to-end (vocal → événement)",
    ],
    configFields: [
      { key: "whatsapp_provider", label: "Fournisseur WhatsApp", type: "text", placeholder: "meta | twilio", required: true },
      { key: "whatsapp_number", label: "Numéro WhatsApp Business", type: "text", placeholder: "+33 6 04 03 70 76" },
      { key: "google_calendar_id", label: "ID du calendrier Google", type: "text", placeholder: "primary" },
      { key: "telegram_bot_token", label: "Token bot Telegram (fallback)", type: "password", help: "Créé via @BotFather sur Telegram" },
      { key: "mcp_endpoint", label: "Endpoint MCP (pour Claude Desktop)", type: "url", placeholder: "https://agents.romerophotography.fr/mcp" },
    ],
  },
  marketing: {
    slug: "marketing",
    name: "Agent Marketing — IG / LinkedIn / Blog",
    tagline: "Un brief, trois publications adaptées à chaque plateforme.",
    description:
      "Vous envoyez un brief (texte, vocal, photos). L'agent génère automatiquement le post Instagram (avec hashtags), le post LinkedIn (ton pro), et l'article de blog complet (SEO inclus). Programmation et publication directes.",
    order: 3,
    steps: [
      "Connexion Instagram Business via Meta Graph API",
      "Configuration du workflow LinkedIn (validation 1-clic)",
      "Branchement au CMS blog du site",
      "Personnalisation des templates par plateforme",
      "Interface de programmation (calendrier éditorial)",
    ],
    configFields: [
      { key: "meta_access_token", label: "Meta Access Token (Instagram)", type: "password", required: true },
      { key: "instagram_business_id", label: "ID compte Instagram Business", type: "text", required: true },
      { key: "linkedin_profile_url", label: "URL profil LinkedIn", type: "url", placeholder: "https://linkedin.com/in/mickael-romero" },
      { key: "brand_voice", label: "Voix éditoriale (ton, mots-clés, tabous)", type: "textarea", placeholder: "Élégant, chaleureux, jamais racoleur…" },
      { key: "openai_whisper_key", label: "Clé API Whisper (transcription vocale)", type: "password" },
    ],
  },
  admin: {
    slug: "admin",
    name: "Agent Administratif & Juridique",
    tagline: "Devis, contrats, factures — générés et signés en un flux.",
    description:
      "Génération automatique des devis, contrats de mariage (mentions légales FR incluses) et factures. Signature électronique via Yousign, comptabilité via Pennylane ou Freebe. Suivi centralisé et relances automatiques des impayés.",
    order: 4,
    steps: [
      "Connexion Yousign (signature électronique)",
      "Connexion Pennylane ou Freebe (compta / URSSAF)",
      "Import des modèles de contrats et devis",
      "Configuration des mentions légales et CGV",
      "Activation des relances automatiques",
    ],
    configFields: [
      { key: "yousign_api_key", label: "Clé API Yousign", type: "password", required: true },
      { key: "accounting_provider", label: "Outil comptable", type: "text", placeholder: "pennylane | freebe", required: true },
      { key: "accounting_api_key", label: "Clé API compta", type: "password", required: true },
      { key: "siret", label: "SIRET", type: "text", placeholder: "123 456 789 00012" },
      { key: "legal_mentions", label: "Mentions légales / CGV (bloc de texte)", type: "textarea" },
    ],
  },
};

export const AGENT_ORDER: AgentSlug[] = (
  Object.values(AGENT_CATALOG) as AgentDef[]
)
  .sort((a, b) => a.order - b.order)
  .map((a) => a.slug);

// ─── DB access ──────────────────────────────────────────────────────────
export async function getAgents(): Promise<AgentInstallation[]> {
  noStore();
  const rows = await query<AgentInstallation>(
    `SELECT slug, name, status, config, system_prompt, installed_at, updated_at
     FROM agent_installations
     ORDER BY slug`
  );
  // Réordonne selon AGENT_ORDER pour un affichage stable côté UI.
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return AGENT_ORDER.map((slug) => bySlug.get(slug)).filter(
    (x): x is AgentInstallation => Boolean(x)
  );
}

export async function getAgent(
  slug: AgentSlug
): Promise<AgentInstallation | null> {
  noStore();
  const rows = await query<AgentInstallation>(
    `SELECT slug, name, status, config, system_prompt, installed_at, updated_at
     FROM agent_installations WHERE slug = $1`,
    [slug]
  );
  return rows[0] ?? null;
}

// Renvoie le prompt personnalisé si non vide, sinon le prompt par défaut.
// Utilisé partout où on a besoin du prompt effectif (playground, appels).
export function effectivePrompt(inst: AgentInstallation): string {
  return inst.system_prompt && inst.system_prompt.trim().length > 0
    ? inst.system_prompt
    : DEFAULT_PROMPTS[inst.slug];
}

export async function setAgentStatus(
  slug: AgentSlug,
  status: AgentStatus
): Promise<void> {
  const installedAt = status === "installed" ? "NOW()" : "installed_at";
  await execute(
    `UPDATE agent_installations
     SET status = $1,
         installed_at = ${installedAt},
         updated_at = NOW()
     WHERE slug = $2`,
    [status, slug]
  );
}

export async function updateAgentConfig(
  slug: AgentSlug,
  patch: Record<string, unknown>
): Promise<void> {
  // Merge côté SQL avec l'opérateur JSONB `||` — évite un round-trip
  // « SELECT config puis UPDATE ». Les clés vides sont supprimées pour
  // ne pas conserver de secrets fantômes.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== "" && v !== null && v !== undefined) cleaned[k] = v;
  }
  await execute(
    `UPDATE agent_installations
     SET config = config || $1::jsonb,
         updated_at = NOW()
     WHERE slug = $2`,
    [JSON.stringify(cleaned), slug]
  );
}

export async function setAgentPrompt(
  slug: AgentSlug,
  prompt: string
): Promise<void> {
  await execute(
    `UPDATE agent_installations
     SET system_prompt = $1, updated_at = NOW()
     WHERE slug = $2`,
    [prompt, slug]
  );
}

// ─── Base de connaissances ─────────────────────────────────────────────
export async function listKnowledge(
  slug: AgentSlug
): Promise<AgentKnowledgeEntry[]> {
  noStore();
  return query<AgentKnowledgeEntry>(
    `SELECT id, agent_slug, title, content, category, updated_at, created_at
     FROM agent_knowledge WHERE agent_slug = $1
     ORDER BY category, title`,
    [slug]
  );
}

export async function addKnowledge(
  slug: AgentSlug,
  entry: { title: string; content: string; category?: string }
): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO agent_knowledge (agent_slug, title, content, category)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [slug, entry.title, entry.content, entry.category ?? "general"]
  );
  return row?.id ?? 0;
}

export async function updateKnowledge(
  id: number,
  patch: { title?: string; content?: string; category?: string }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (typeof patch.title === "string") {
    sets.push(`title = $${i++}`);
    params.push(patch.title);
  }
  if (typeof patch.content === "string") {
    sets.push(`content = $${i++}`);
    params.push(patch.content);
  }
  if (typeof patch.category === "string") {
    sets.push(`category = $${i++}`);
    params.push(patch.category);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = NOW()");
  params.push(id);
  await execute(
    `UPDATE agent_knowledge SET ${sets.join(", ")} WHERE id = $${i}`,
    params
  );
}

export async function deleteKnowledge(id: number): Promise<void> {
  await execute(`DELETE FROM agent_knowledge WHERE id = $1`, [id]);
}

// ─── Événements (audit + stats) ────────────────────────────────────────
export async function logEvent(
  slug: AgentSlug,
  eventType: string,
  payload: Record<string, unknown> = {},
  success = true
): Promise<void> {
  await execute(
    `INSERT INTO agent_events (agent_slug, event_type, payload, success)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [slug, eventType, JSON.stringify(payload), success]
  );
}

export async function listEvents(
  slug: AgentSlug,
  limit = 50
): Promise<AgentEvent[]> {
  noStore();
  return query<AgentEvent>(
    `SELECT id, agent_slug, event_type, payload, success, created_at
     FROM agent_events WHERE agent_slug = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [slug, limit]
  );
}

export type AgentStats = {
  total_events: number;
  success_events: number;
  failure_events: number;
  by_type: Array<{ event_type: string; count: number }>;
  daily: Array<{ day: string; count: number; success: number }>;
};

export async function getStats(slug: AgentSlug): Promise<AgentStats> {
  noStore();
  const [totals, byType, daily] = await Promise.all([
    queryOne<{
      total: number;
      ok: number;
      fail: number;
    }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE success)::int AS ok,
              COUNT(*) FILTER (WHERE NOT success)::int AS fail
       FROM agent_events WHERE agent_slug = $1`,
      [slug]
    ),
    query<{ event_type: string; count: number }>(
      `SELECT event_type, COUNT(*)::int AS count
       FROM agent_events WHERE agent_slug = $1
       GROUP BY event_type ORDER BY count DESC`,
      [slug]
    ),
    query<{ day: string; count: number; success: number }>(
      `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE success)::int AS success
       FROM agent_events
       WHERE agent_slug = $1
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY 1 ORDER BY 1`,
      [slug]
    ),
  ]);
  return {
    total_events: totals?.total ?? 0,
    success_events: totals?.ok ?? 0,
    failure_events: totals?.fail ?? 0,
    by_type: byType,
    daily,
  };
}

// ─── Playground (test) ─────────────────────────────────────────────────
export async function saveTestMessage(entry: {
  agent_slug: AgentSlug;
  input_text: string;
  output_text: string;
  prompt_snapshot: string;
  duration_ms: number;
  success: boolean;
  error_message?: string | null;
}): Promise<number> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO agent_test_messages
       (agent_slug, input_text, output_text, prompt_snapshot,
        duration_ms, success, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      entry.agent_slug,
      entry.input_text,
      entry.output_text,
      entry.prompt_snapshot,
      entry.duration_ms,
      entry.success,
      entry.error_message ?? null,
    ]
  );
  return row?.id ?? 0;
}

export async function listTestMessages(
  slug: AgentSlug,
  limit = 20
): Promise<AgentTestMessage[]> {
  noStore();
  return query<AgentTestMessage>(
    `SELECT id, agent_slug, input_text, output_text, prompt_snapshot,
            duration_ms, success, error_message, created_at
     FROM agent_test_messages WHERE agent_slug = $1
     ORDER BY created_at DESC LIMIT $2`,
    [slug, limit]
  );
}
