/**
 * Helper unique pour router les appels Claude vers Anthropic direct
 * OU OpenRouter (proxy Anthropic-compatible, utile quand la carte
 * refuse le paiement Anthropic direct).
 *
 * Activation via env var : OPENROUTER_API_KEY
 *   - Si présent → route via https://openrouter.ai/api/v1/messages
 *   - Sinon      → route via https://api.anthropic.com/v1/messages
 *
 * L'API et le body sont IDENTIQUES (OpenRouter proxifie l'endpoint
 * Anthropic natif). Seuls URL, header d'auth et prefix modèle changent.
 */

// Mapping des modèles Anthropic vers leurs noms OpenRouter (dots au lieu
// des dashes + date). Pour tout modèle non listé, prefix `anthropic/`
// et on laisse OpenRouter router en pass-through.
const OPENROUTER_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5-20251001": "anthropic/claude-haiku-4.5",
  "claude-haiku-4-5": "anthropic/claude-haiku-4.5",
  "claude-sonnet-4-5-20250929": "anthropic/claude-sonnet-4.5",
  "claude-opus-4-8": "anthropic/claude-opus-4.8",
  "claude-opus-4-7": "anthropic/claude-opus-4.7",
};

export type ClaudeEndpoint = {
  url: string;
  headers: Record<string, string>;
  model: string;
  /** true si le trafic va via OpenRouter (utile pour logs/health) */
  viaOpenRouter: boolean;
};

export function getClaudeEndpoint(input: {
  /** Clé API Anthropic saisie côté agent — utilisée en fallback direct */
  userApiKey: string;
  /** Nom du modèle tel que défini dans le code (format Anthropic natif) */
  model: string;
}): ClaudeEndpoint {
  const orKey = process.env.OPENROUTER_API_KEY?.replace(/^﻿/, "").trim();
  if (orKey) {
    return {
      url: "https://openrouter.ai/api/v1/messages",
      headers: {
        "content-type": "application/json",
        "x-api-key": orKey,
        "anthropic-version": "2023-06-01",
        // Meta pour dashboard OpenRouter — attributions.
        "HTTP-Referer": "https://romerophotography.fr",
        "X-Title": "Romero Studio",
      },
      model:
        OPENROUTER_MODEL_MAP[input.model] || `anthropic/${input.model}`,
      viaOpenRouter: true,
    };
  }
  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.userApiKey,
      "anthropic-version": "2023-06-01",
    },
    model: input.model,
    viaOpenRouter: false,
  };
}
