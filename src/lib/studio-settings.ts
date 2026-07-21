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
import { STUDIO_SETTINGS_FIELDS } from "@/lib/studio-settings-fields";
// Re-export pour compat des imports serveur existants.
export { STUDIO_SETTINGS_FIELDS };
export type { StudioFieldKey } from "@/lib/studio-settings-fields";

// ─── Lecture ─────────────────────────────────────────────────────────
// Petit cache in-memory à durée courte : évite les 4 requêtes
// répétées lors d'un même render (getAgent est appelé pour chaque
// agent sur la landing).
let _cache: { value: Record<string, string>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000;

/**
 * Mapping clé DB → variable d'environnement. Les clés techniques
 * (Anthropic, OpenAI, Meta App, Google OAuth) sont normalement fournies
 * via Vercel ENV pour que le user n'ait rien à copier-coller. Elles
 * restent overridables par-agent si besoin.
 */
const ENV_FALLBACKS: Record<string, string | undefined> = {
  anthropic_api_key:      process.env.ANTHROPIC_API_KEY,
  openai_api_key:         process.env.OPENAI_API_KEY,
  meta_app_id:            process.env.META_APP_ID,
  meta_app_secret:        process.env.META_APP_SECRET,
  google_client_id:       process.env.GOOGLE_CLIENT_ID,
  google_client_secret:   process.env.GOOGLE_CLIENT_SECRET,
  telegram_bot_token:     process.env.TELEGRAM_BOT_TOKEN,
  whatsapp_verify_token:  process.env.WHATSAPP_VERIFY_TOKEN,
};

export async function getSharedConfig(): Promise<Record<string, string>> {
  noStore();
  const now = Date.now();
  if (_cache && _cache.expiresAt > now) return _cache.value;

  const map: Record<string, string> = {};
  // 1) On part des ENV (défauts fournis par la plateforme).
  for (const [k, v] of Object.entries(ENV_FALLBACKS)) {
    if (typeof v === "string" && v.trim() !== "") map[k] = v;
  }
  // 2) On surcharge avec ce que le user a explicitement mis en DB.
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM studio_settings`
    );
    for (const r of rows) if (r.value) map[r.key] = r.value;
  } catch {
    // Table manquante (migration pas encore jouée) → on garde juste ENV.
  }
  _cache = { value: map, expiresAt: now + CACHE_TTL_MS };
  return map;
}

export function invalidateSharedConfigCache(): void {
  _cache = null;
}

// ─── Écriture ────────────────────────────────────────────────────────
/**
 * Écrit directement une clé partagée sans passer par la whitelist des
 * champs user-facing. Utilisé UNIQUEMENT côté serveur par les callbacks
 * OAuth pour stocker les tokens (google_refresh_token, meta_access_token,
 * instagram_business_id…) qui ne sont pas exposés dans le formulaire
 * Studio Settings mais doivent être partagés entre tous les agents.
 */
export async function writeSharedKey(key: string, value: string): Promise<void> {
  const clean = typeof value === "string" ? value.trim() : "";
  if (clean === "") {
    await execute(`DELETE FROM studio_settings WHERE key = $1`, [key]);
  } else {
    await execute(
      `INSERT INTO studio_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, clean]
    );
  }
  invalidateSharedConfigCache();
}

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
