import { unstable_noStore as noStore } from "next/cache";
import { query, execute } from "@/lib/db";

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
  installed_at: string | null;
  updated_at: string;
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
    `SELECT slug, name, status, config, installed_at, updated_at
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
    `SELECT slug, name, status, config, installed_at, updated_at
     FROM agent_installations WHERE slug = $1`,
    [slug]
  );
  return rows[0] ?? null;
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
