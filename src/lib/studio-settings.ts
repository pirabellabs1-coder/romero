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
