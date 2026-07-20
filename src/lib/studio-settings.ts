/**
 * Studio settings — clés API et paramètres partagés par les 4 agents.
 * ─────────────────────────────────────────────────────────────────────
 * Élimine la duplication : au lieu de coller la même clé Anthropic dans
 * chacun des 4 agents, on la met une fois ici, et chaque agent en
 * hérite automatiquement via getAgent() / getAgents() qui font le
 * merge côté lecture.
 *
 * Règle de fusion : le champ spécifique à l'agent (agent_installations.config)
 * a la priorité sur le champ partagé. Un agent peut donc override si besoin.
 *
 * Cache de 5 s pour éviter de refaire la requête sur chaque appel dans
 * un même render (les composants React server appellent souvent getAgent
 * plusieurs fois).
 */
import { unstable_noStore as noStore } from "next/cache";
import { query, execute } from "@/lib/db";

// Liste blanche des champs autorisés en shared — évite qu'un
// contributeur push accidentellement des clés par-agent (comme
// google_refresh_token qui n'a de sens que pour l'agent WhatsApp).
export const STUDIO_SETTINGS_FIELDS = [
  // ─── Clés IA (utilisées par plusieurs agents) ─────
  { key: "anthropic_api_key",     label: "Clé API Anthropic (Claude)",             type: "password", section: "ia", help: "Utilisée par les 4 agents (chatbot, whatsapp, marketing, admin)" },
  { key: "openai_api_key",        label: "Clé API OpenAI (Whisper)",               type: "password", section: "ia", help: "Utilisée par WhatsApp (vocaux) et Marketing (briefs vocaux)" },

  // ─── Meta / Instagram (partagés Marketing + éventuellement Site) ─
  { key: "meta_access_token",     label: "Meta Page Access Token (long-lived)",    type: "password", section: "meta", help: "Publication Instagram + éventuels tools cross-agent" },
  { key: "instagram_business_id", label: "Instagram Business Account ID",          type: "text",     section: "meta", help: "ID numérique du compte @romeromomentsphoto" },

  // ─── Google OAuth (partagé WhatsApp + éventuellement Site pour Cal) ─
  { key: "google_client_id",      label: "Google OAuth Client ID",                 type: "text",     section: "google", help: "Créé dans Google Cloud Console → APIs & Services → Credentials" },
  { key: "google_client_secret",  label: "Google OAuth Client Secret",             type: "password", section: "google", help: "Le refresh_token reste spécifique à chaque agent (lié au compte connecté)" },

  // ─── Identité entreprise (utilisée dans les prompts + docs admin) ─
  { key: "legal_status",          label: "Statut juridique",                       type: "text",     section: "legal", help: "Micro-entrepreneur / EI / EURL / SASU / SAS" },
  { key: "legal_name",            label: "Nom légal complet",                      type: "text",     section: "legal", help: "Utilisé sur factures, contrats, mentions" },
  { key: "siret",                 label: "SIRET",                                  type: "text",     section: "legal", help: "14 chiffres" },
  { key: "rcs_city",              label: "Ville d'immatriculation RCS",            type: "text",     section: "legal", help: "Ex : Nice (si société — vide si micro)" },
  { key: "legal_address",         label: "Adresse professionnelle",                type: "textarea", section: "legal", help: "Apparaît en en-tête des documents" },
  { key: "vat_number",            label: "N° TVA intracommunautaire",              type: "text",     section: "legal", help: "Ex : FR12345678901 — laisser vide si franchise TVA (micro)" },
  { key: "vat_applicable",        label: "Assujetti à la TVA (yes/no)",            type: "text",     section: "legal", help: "yes = ajouter TVA sur factures, no = franchise art. 293 B" },

  // ─── Contact (référence croisée pour les agents et les mails) ────
  { key: "notification_email",    label: "E-mail de notification global",          type: "text",     section: "contact", help: "Redirige les mails de leads / alertes ici (par défaut = MAIL_TO env)" },
  { key: "public_phone",          label: "Téléphone public",                       type: "text",     section: "contact", help: "Communiqué par le chatbot aux prospects sérieux" },
] as const;

export type StudioFieldKey = (typeof STUDIO_SETTINGS_FIELDS)[number]["key"];

// ─── Lecture ─────────────────────────────────────────────────────────
// Petit cache in-memory à durée courte : évite les 4 requêtes
// répétées lors d'un même render (getAgent est appelé pour chaque
// agent sur la landing).
let _cache: { value: Record<string, string>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000;

export async function getSharedConfig(): Promise<Record<string, string>> {
  noStore();
  const now = Date.now();
  if (_cache && _cache.expiresAt > now) return _cache.value;
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM studio_settings`
    );
    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;
    _cache = { value: map, expiresAt: now + CACHE_TTL_MS };
    return map;
  } catch {
    // Table manquante (migration pas encore jouée) → renvoie vide.
    // Les agents fonctionnent comme avant, sans hériter.
    return {};
  }
}

export function invalidateSharedConfigCache(): void {
  _cache = null;
}

// ─── Écriture ────────────────────────────────────────────────────────
export async function updateSharedConfig(
  patch: Record<string, string>
): Promise<void> {
  // Sécurité : n'accepte que les clés whitelisted. Ignore silencieusement
  // les autres pour éviter les erreurs de manipulation.
  const allowed = new Set<string>(STUDIO_SETTINGS_FIELDS.map((f) => f.key));
  const clean: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    // Trim + accepte les valeurs vides (permet de supprimer un champ).
    clean.push([k, typeof v === "string" ? v.trim() : ""]);
  }
  if (clean.length === 0) return;

  // Upsert multi-lignes en une requête. Une valeur vide → on supprime
  // la ligne pour rester propre.
  for (const [k, v] of clean) {
    if (v === "") {
      await execute(`DELETE FROM studio_settings WHERE key = $1`, [k]);
    } else {
      await execute(
        `INSERT INTO studio_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [k, v]
      );
    }
  }
  invalidateSharedConfigCache();
}

// ─── Helper de merge : agent-specific override shared ────────────────
export function mergeConfigWithShared(
  agentConfig: Record<string, unknown>,
  shared: Record<string, string>
): Record<string, unknown> {
  // On part du shared, puis on écrase avec agent-specific NON VIDE.
  // Un champ vide côté agent n'écrase PAS le partagé (permet d'unset).
  const result: Record<string, unknown> = { ...shared };
  for (const [k, v] of Object.entries(agentConfig || {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    result[k] = v;
  }
  return result;
}
