import { unstable_noStore as noStore } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";
import { DEFAULT_PROMPTS } from "@/lib/agent-prompts";
import { getSharedConfig, mergeConfigWithShared } from "@/lib/studio-settings";

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
    /** true = champ technique (clé API, token OAuth, ID plateforme).
     *  Ces champs sont normalement remplis via Studio Settings, ENV
     *  Vercel ou un flow OAuth 1-clic. On les cache derrière un
     *  toggle « Options avancées » pour ne pas noyer le user. */
    advanced?: boolean;
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
      { key: "anthropic_api_key", label: "Clé API Anthropic (Claude)", type: "password", required: true, help: "Fournie par la plateforme — override uniquement si besoin", advanced: true },
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
      "Assistant personnel accessible depuis WhatsApp et Telegram. Il comprend les vocaux, crée / modifie / consulte vos événements Google Calendar, et vous répond en langage naturel.",
    order: 2,
    steps: [
      "Créer un compte Meta Business + valider le numéro WhatsApp",
      "OAuth Google Calendar (bouton « Connecter » dans l'onglet Configuration)",
      "Configurer le bot Telegram (fallback pendant la validation Meta)",
      "Renseigner la clé API Claude + la clé Whisper (transcription vocale)",
      "Test end-to-end (envoyer un vocal → événement créé)",
    ],
    configFields: [
      // Champs simples visibles par défaut
      { key: "google_calendar_id", label: "ID du calendrier Google", type: "text", placeholder: "primary", help: "Laisser « primary » pour l'agenda par défaut" },
      { key: "google_timezone", label: "Fuseau horaire", type: "text", placeholder: "Europe/Paris" },
      { key: "telegram_allowed_user_id", label: "Votre ID utilisateur Telegram", type: "text", help: "Empêche que quelqu'un d'autre parle à votre bot. Récupérer via @userinfobot" },
      { key: "whatsapp_allowed_from", label: "Votre numéro WhatsApp autorisé", type: "text", placeholder: "+33604037076" },
      // ─── Advanced (fourni par la plateforme / OAuth / ENV) ─────────
      { key: "anthropic_api_key", label: "Clé API Anthropic (Claude)", type: "password", help: "Fournie par la plateforme — override si besoin", advanced: true },
      { key: "google_client_id", label: "Google OAuth Client ID", type: "text", help: "Fourni par la plateforme (bouton « Connecter Google Agenda »)", advanced: true },
      { key: "google_client_secret", label: "Google OAuth Client Secret", type: "password", help: "Fourni par la plateforme", advanced: true },
      { key: "openai_api_key", label: "Clé API OpenAI (Whisper vocaux)", type: "password", help: "Optionnel — pour transcrire les vocaux", advanced: true },
      { key: "telegram_bot_token", label: "Token bot Telegram", type: "password", help: "Créé via @BotFather sur Telegram", advanced: true },
      { key: "whatsapp_verify_token", label: "WhatsApp verify token", type: "text", help: "Chaîne secrète à définir puis à recopier dans Meta", advanced: true },
      { key: "whatsapp_phone_number_id", label: "WhatsApp Phone Number ID", type: "text", advanced: true },
      { key: "whatsapp_access_token", label: "WhatsApp Access Token (Meta)", type: "password", advanced: true },
    ],
  },
  marketing: {
    slug: "marketing",
    name: "Agent Marketing — IG / LinkedIn / Blog",
    tagline: "Un brief, trois publications adaptées à chaque plateforme.",
    description:
      "Vous envoyez un brief (texte, vocal, photos). L'agent génère automatiquement le post Instagram (caption + hashtags), le post LinkedIn (ton pro), et l'article de blog complet (SEO inclus). Publication Instagram directe, LinkedIn en 1 clic, blog en brouillon dans votre back-office.",
    order: 3,
    steps: [
      "Passer Instagram en Business et le lier à une Page Facebook",
      "Créer une app Meta Graph API et récupérer le Page Access Token",
      "Renseigner Claude + OpenAI (transcription vocaux) + Meta",
      "Personnaliser votre voix éditoriale et vos hashtags signature",
      "Envoyer votre premier brief pour voir 3 drafts prêts en 20 secondes",
    ],
    configFields: [
      // Personnalisation éditoriale (visible par défaut)
      { key: "brand_voice", label: "Voix éditoriale (ton, mots-clés, tabous)", type: "textarea", placeholder: "Élégant, chaleureux, jamais racoleur. Jamais de « swipe up ». Toujours attentif à l'émotion avant l'esthétique." },
      { key: "signature_hashtags", label: "Hashtags signature (séparés par un espace)", type: "textarea", placeholder: "#photographemariagenice #mariageprovence #weddingphotographer #mariage2027" },
      { key: "blog_default_lang", label: "Langue par défaut du blog (fr / en)", type: "text", placeholder: "fr" },
      { key: "linkedin_profile_url", label: "URL profil LinkedIn", type: "url", placeholder: "https://linkedin.com/in/mickael-romero", help: "Pour référence — LinkedIn ne permet pas la publication auto" },
      // ─── Advanced (fourni par la plateforme / OAuth / ENV) ─────────
      { key: "anthropic_api_key", label: "Clé API Anthropic (Claude)", type: "password", help: "Fournie par la plateforme", advanced: true },
      { key: "openai_api_key", label: "Clé API OpenAI (Whisper vocaux)", type: "password", help: "Fournie par la plateforme", advanced: true },
      { key: "meta_access_token", label: "Meta Page Access Token", type: "password", help: "Rempli automatiquement par « Connecter Instagram »", advanced: true },
      { key: "instagram_business_id", label: "Instagram Business Account ID", type: "text", help: "Rempli automatiquement par « Connecter Instagram »", advanced: true },
    ],
  },
  admin: {
    slug: "admin",
    name: "Agent Administratif & Juridique",
    tagline: "Devis, contrats, factures — générés et signés en un flux.",
    description:
      "Génération automatique des devis, contrats de mariage (mentions légales FR incluses) et factures depuis un brief court. PDF prêts à imprimer ou à signer électroniquement via Yousign. Facturation synchronisée avec Pennylane ou Freebe pour la conformité URSSAF.",
    order: 4,
    steps: [
      "Renseigner votre profil légal (statut, SIRET, adresse, TVA)",
      "Ajouter Anthropic (génération) + Yousign (signature) + Pennylane/Freebe (compta)",
      "Décrire un premier devis en une phrase → PDF prêt en 5 secondes",
      "Envoyer à signer en 1 clic (Yousign)",
      "Après signature : la facture est créée automatiquement dans votre compta",
    ],
    configFields: [
      // Champs simples — coordonnées + IBAN + modèles
      { key: "company_iban", label: "IBAN pour paiements", type: "text", help: "Apparaît en bas des factures pour que tes clients puissent virer" },
      { key: "company_email", label: "E-mail professionnel (facultatif)", type: "text", placeholder: "Utilise le mail Studio Settings si vide" },
      { key: "company_phone", label: "Téléphone professionnel (facultatif)", type: "text", placeholder: "Utilise le téléphone Studio Settings si vide" },
      { key: "legal_mentions", label: "CGV / mentions légales", type: "textarea", help: "Bloc annexé aux contrats — laisse vide pour la version standard" },
      { key: "contract_extra_clauses", label: "Clauses contractuelles additionnelles", type: "textarea", help: "Droit à l'image, force majeure, cas particuliers…" },
      // ─── Advanced (fourni par la plateforme / Studio / ENV) ────────
      { key: "anthropic_api_key", label: "Clé API Anthropic (Claude)", type: "password", help: "Fournie par la plateforme", advanced: true },
      { key: "company_legal_name", label: "Raison sociale (fallback)", type: "text", help: "Utilise legal_name du Studio Settings — override uniquement si besoin", advanced: true },
      { key: "company_status", label: "Statut juridique (fallback)", type: "text", help: "Utilise legal_status du Studio", advanced: true },
      { key: "company_siret", label: "SIRET (fallback)", type: "text", help: "Utilise siret du Studio", advanced: true },
      { key: "company_rcs", label: "RCS", type: "text", help: "Optionnel — pour sociétés uniquement", advanced: true },
      { key: "company_address", label: "Adresse pro (fallback)", type: "textarea", help: "Utilise legal_address du Studio", advanced: true },
      { key: "vat_status", label: "Assujetti TVA (fallback yes/no)", type: "text", help: "Utilise vat_applicable du Studio", advanced: true },
      { key: "vat_rate", label: "Taux TVA (%)", type: "text", placeholder: "20", advanced: true },
      { key: "vat_number", label: "N° TVA (fallback)", type: "text", help: "Utilise vat_number du Studio", advanced: true },
      { key: "yousign_api_key", label: "Clé API Yousign", type: "password", help: "Optionnel — sans clé, les documents sont juste des PDF téléchargeables", advanced: true },
      { key: "yousign_environment", label: "Environnement Yousign", type: "text", placeholder: "sandbox", advanced: true },
      { key: "accounting_provider", label: "Outil comptable", type: "text", placeholder: "pennylane | freebe | none", advanced: true },
      { key: "accounting_api_key", label: "Clé API compta", type: "password", advanced: true },
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
  const [rows, shared] = await Promise.all([
    query<AgentInstallation>(
      `SELECT slug, name, status, config, system_prompt, installed_at, updated_at
       FROM agent_installations
       ORDER BY slug`
    ),
    getSharedConfig(),
  ]);
  // Merge chaque config avec le shared. Ordre : shared < agent-specific.
  // Effet : ajouter la clé Claude dans Studio Settings suffit pour que
  // les 4 agents la voient — plus besoin de la coller 4 fois.
  const merged = rows.map((r) => ({
    ...r,
    config: mergeConfigWithShared(r.config as Record<string, unknown>, shared),
  }));
  // Réordonne selon AGENT_ORDER pour un affichage stable côté UI.
  const bySlug = new Map(merged.map((r) => [r.slug, r]));
  return AGENT_ORDER.map((slug) => bySlug.get(slug)).filter(
    (x): x is AgentInstallation => Boolean(x)
  );
}

export async function getAgent(
  slug: AgentSlug
): Promise<AgentInstallation | null> {
  noStore();
  const [rows, shared] = await Promise.all([
    query<AgentInstallation>(
      `SELECT slug, name, status, config, system_prompt, installed_at, updated_at
       FROM agent_installations WHERE slug = $1`,
      [slug]
    ),
    getSharedConfig(),
  ]);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    config: mergeConfigWithShared(row.config as Record<string, unknown>, shared),
  };
}

// Renvoie la config BRUTE de l'agent (sans merge avec Studio Settings).
// À utiliser dans le formulaire de config pour distinguer ce qui est
// override localement vs hérité — sinon l'UI montrerait la valeur
// partagée comme si elle était propre à l'agent.
export async function getAgentRawConfig(
  slug: AgentSlug
): Promise<Record<string, unknown>> {
  noStore();
  const row = await queryOne<{ config: Record<string, unknown> }>(
    `SELECT config FROM agent_installations WHERE slug = $1`,
    [slug]
  );
  return row?.config ?? {};
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
// ─── Health live pour indicateurs UI ────────────────────────────────────
// Un snapshot compact utilisé par la landing et les Overview pour
// afficher un pulse vert, la dernière activité, le taux de succès sur
// l'heure passée, la latence moyenne. Une seule requête SQL par agent.
export type AgentHealth = {
  slug: AgentSlug;
  status: AgentStatus;
  is_live: boolean; // événement dans les 5 dernières minutes
  last_event_at: string | null;
  events_last_hour: number;
  events_last_24h: number;
  success_rate_24h: number; // 0-100
  hourly_buckets: number[]; // 24 valeurs (aujourd'hui, heure par heure)
};

export async function getAgentHealth(slug: AgentSlug): Promise<AgentHealth> {
  noStore();
  const row = await queryOne<{
    status: AgentStatus;
    last_event_at: string | null;
    events_last_hour: number;
    events_last_24h: number;
    events_ok_24h: number;
  }>(
    `SELECT
        i.status,
        (SELECT MAX(created_at)::text FROM agent_events WHERE agent_slug = $1) AS last_event_at,
        (SELECT COUNT(*)::int FROM agent_events
           WHERE agent_slug = $1 AND created_at >= NOW() - INTERVAL '1 hour') AS events_last_hour,
        (SELECT COUNT(*)::int FROM agent_events
           WHERE agent_slug = $1 AND created_at >= NOW() - INTERVAL '24 hours') AS events_last_24h,
        (SELECT COUNT(*)::int FROM agent_events
           WHERE agent_slug = $1 AND created_at >= NOW() - INTERVAL '24 hours' AND success) AS events_ok_24h
     FROM agent_installations i WHERE slug = $1`,
    [slug]
  );

  // Buckets horaires sur 24 h (utilisés pour la sparkline)
  const buckets = await query<{ hour: number; count: number }>(
    `SELECT
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS raw_hour,
        COUNT(*)::int AS count
      FROM agent_events
      WHERE agent_slug = $1 AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY floor(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600)
      HAVING floor(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) < 24`,
    [slug]
  ).catch(() => []);

  // On construit 24 slots (0 = maintenant, 23 = il y a 23 h).
  const slots = new Array(24).fill(0) as number[];
  for (const b of buckets) {
    const idx = Math.min(23, Math.max(0, Math.floor(Number(b.hour))));
    slots[idx] = (slots[idx] ?? 0) + Number(b.count);
  }
  // On inverse : slot 0 = 23 h ago … slot 23 = maintenant (pour le graphe de gauche à droite).
  const hourly = slots.slice().reverse();

  const last = row?.last_event_at ? new Date(row.last_event_at) : null;
  const is_live = last ? Date.now() - last.getTime() < 5 * 60 * 1000 : false;
  const total = row?.events_last_24h ?? 0;
  const ok = row?.events_ok_24h ?? 0;

  return {
    slug,
    status: row?.status ?? "not_installed",
    is_live,
    last_event_at: row?.last_event_at ?? null,
    events_last_hour: row?.events_last_hour ?? 0,
    events_last_24h: total,
    success_rate_24h: total > 0 ? Math.round((ok / total) * 100) : 100,
    hourly_buckets: hourly,
  };
}

export async function getAllAgentHealth(): Promise<AgentHealth[]> {
  noStore();
  return Promise.all(AGENT_ORDER.map((s) => getAgentHealth(s)));
}

// Latence moyenne récente basée sur les test_messages (le seul endroit
// où on capture duration_ms de bout en bout de manière fiable). Utile
// pour l'histogramme dans l'onglet Stats.
export async function getLatencyHistogram(
  slug: AgentSlug
): Promise<Array<{ bucket_ms: number; count: number }>> {
  noStore();
  // Buckets : 0-500, 500-1000, 1000-2000, 2000-4000, 4000+
  return query<{ bucket_ms: number; count: number }>(
    `SELECT
        CASE
          WHEN duration_ms < 500 THEN 500
          WHEN duration_ms < 1000 THEN 1000
          WHEN duration_ms < 2000 THEN 2000
          WHEN duration_ms < 4000 THEN 4000
          ELSE 8000
        END AS bucket_ms,
        COUNT(*)::int AS count
     FROM agent_test_messages
     WHERE agent_slug = $1 AND duration_ms IS NOT NULL AND duration_ms > 0
       AND created_at >= NOW() - INTERVAL '7 days'
     GROUP BY bucket_ms
     ORDER BY bucket_ms`,
    [slug]
  );
}

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
