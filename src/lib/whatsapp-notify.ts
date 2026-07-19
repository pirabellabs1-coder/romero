/**
 * notifyMickael — envoie un message unidirectionnel à Mickael.
 * ───────────────────────────────────────────────────────────────
 * Utilisé par les crons (rappels quotidiens + récap hebdo) pour
 * pousser des notifications sans attendre qu'il envoie un message.
 *
 * Priorité :
 *   1. WhatsApp Cloud API si `whatsapp_access_token`,
 *      `whatsapp_phone_number_id` et `whatsapp_allowed_from` sont
 *      renseignés.
 *   2. Telegram Bot API si `telegram_bot_token` et
 *      `telegram_allowed_user_id` sont renseignés (fallback).
 *   3. Aucun envoi si aucun canal n'est configuré (le cron termine
 *      proprement avec un warning).
 *
 * Design :
 *   - Aucun retry auto — les crons sont idempotents, on ne veut
 *     pas doubler les messages en cas de blip réseau.
 *   - Chunking à 3800 caractères pour Telegram (limite 4096) et
 *     4000 pour WhatsApp (limite 4096 également mais on marge).
 *   - Retour typé { ok, provider?, error?, warnings? }.
 */
import { getAgent } from "@/lib/agents";

export type NotifyResult =
  | { ok: true; provider: "whatsapp" | "telegram"; chunks: number }
  | { ok: false; error: string };

export async function notifyMickael(text: string): Promise<NotifyResult> {
  const inst = await getAgent("whatsapp").catch(() => null);
  if (!inst) return { ok: false, error: "agent whatsapp indisponible" };
  const cfg = inst.config as {
    whatsapp_access_token?: string;
    whatsapp_phone_number_id?: string;
    whatsapp_allowed_from?: string;
    telegram_bot_token?: string;
    telegram_allowed_user_id?: string;
  };

  // ─── Tentative 1 : WhatsApp Cloud API ───────────────
  if (
    cfg.whatsapp_access_token &&
    cfg.whatsapp_phone_number_id &&
    cfg.whatsapp_allowed_from
  ) {
    const chunks = chunkString(text, 4000);
    let ok = true;
    for (const chunk of chunks) {
      const resp = await fetch(
        `https://graph.facebook.com/v22.0/${cfg.whatsapp_phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${cfg.whatsapp_access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cfg.whatsapp_allowed_from.replace(/^\+/, ""),
            type: "text",
            text: { body: chunk, preview_url: false },
          }),
        }
      );
      if (!resp.ok) {
        const t = await resp.text();
        console.warn(
          `[notify/whatsapp] échec HTTP ${resp.status} · ${t.slice(0, 200)}`
        );
        ok = false;
        break;
      }
    }
    if (ok)
      return { ok: true, provider: "whatsapp", chunks: chunks.length };
  }

  // ─── Tentative 2 : Telegram (fallback) ──────────────
  if (cfg.telegram_bot_token && cfg.telegram_allowed_user_id) {
    const chunks = chunkString(text, 3800);
    for (const chunk of chunks) {
      const resp = await fetch(
        `https://api.telegram.org/bot${cfg.telegram_bot_token}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: cfg.telegram_allowed_user_id,
            text: chunk,
            disable_web_page_preview: true,
          }),
        }
      );
      if (!resp.ok) {
        const t = await resp.text();
        return {
          ok: false,
          error: `Telegram HTTP ${resp.status} · ${t.slice(0, 200)}`,
        };
      }
    }
    return { ok: true, provider: "telegram", chunks: chunks.length };
  }

  return {
    ok: false,
    error:
      "aucun canal configuré (renseigner WhatsApp Cloud API ou Telegram dans /admin/agents/whatsapp)",
  };
}

function chunkString(s: string, size: number): string[] {
  if (s.length <= size) return [s];
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    out.push(s.slice(i, i + size));
    i += size;
  }
  return out;
}
