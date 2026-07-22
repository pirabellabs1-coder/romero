/**
 * Flow de validation par Telegram
 * ───────────────────────────────
 * Quand un contact form arrive (ou un lead chatbot, ou un DM IG), on
 * demande à Claude de rédiger une réponse personnalisée, on l'envoie
 * à Mickael sur Telegram avec 3 boutons : ✓ Valider · ✎ Modifier · ✗
 * Ignorer. Un clic → email envoyé au client automatiquement.
 *
 * Table: pending_approvals
 * Callback data format: "act:<id>:<action>" (act = ns pour approval)
 *
 * L'idée : garder l'humain dans la boucle sans lui faire écrire une
 * seule ligne. Trust + productivité.
 */
import { execute, queryOne } from "@/lib/db";
import { getAgent } from "@/lib/agents";
import { getSharedConfig } from "@/lib/studio-settings";
import { sendMail } from "@/lib/mailer";
import { getClaudeEndpoint } from "@/lib/claude-endpoint";

export type ApprovalSource = "contact_form" | "chatbot" | "instagram";

// ─── Génération du draft via Claude ────────────────────────────────
async function draftResponse(input: {
  contactName: string;
  contactMessage: string;
  contactMeta: string;
  language: "fr" | "en";
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const shared = await getSharedConfig().catch(() => ({} as Record<string, string>));
  const apiKey = shared.anthropic_api_key ?? "";
  if (!apiKey && !process.env.OPENROUTER_API_KEY)
    return { ok: false, error: "Clé Claude manquante (ni Anthropic ni OpenRouter)" };

  const siteAgent = await getAgent("site").catch(() => null);
  const kbSnippet = siteAgent?.system_prompt?.slice(0, 4000) ?? "";

  const persona = `Tu es Mickael Romero, photographe de mariage à Nice, France. Tu réponds personnellement, avec un ton chaleureux, sincère, jamais commercial. Signe simplement « Mickael » ou « Mickael Romero ».`;

  const userPrompt = `Un(e) prospect(e) vient de remplir le formulaire de contact du site.
Voici ses informations :
- Nom : ${input.contactName}
- Message : « ${input.contactMessage} »
${input.contactMeta ? "\n" + input.contactMeta : ""}

Rédige une réponse email courte (5-8 lignes maxi) et personnelle en ${input.language === "en" ? "anglais" : "français"} :
- Accueil chaleureux (utilise son prénom)
- Réponse rapide aux questions posées si tu peux (sur la base de ton site : tu es photographe de mariage à Nice, tu couvres la Provence et la Côte d'Azur, séances engagement dispo, tarifs sur devis personnalisé)
- Propose un appel visio de 15 min pour en parler ensemble (précise que Mickael revient rapidement pour caler un créneau)
- Signature : « Mickael » ou « Mickael Romero »
- Ne mentionne PAS de tarifs précis (dis que tu envoies un devis personnalisé après échange)

Réponds UNIQUEMENT avec le texte de l'email, sans introduction ni méta-commentaire.`;

  try {
    const ep = getClaudeEndpoint({ userApiKey: apiKey, model: "claude-haiku-4-5-20251001" });
    const r = await fetch(ep.url, {
      method: "POST",
      headers: ep.headers,
      body: JSON.stringify({
        model: ep.model,
        max_tokens: 700,
        system: persona + (kbSnippet ? "\n\nContexte (base de connaissances) :\n" + kbSnippet : ""),
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { ok: false, error: `HTTP ${r.status}: ${body.slice(0, 200)}` };
    }
    const json = (await r.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    if (!text) return { ok: false, error: "Pas de texte dans la réponse Claude" };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau Claude" };
  }
}

// ─── Envoi Telegram avec inline keyboard ───────────────────────────
async function sendTelegramApprovalMessage(input: {
  botToken: string;
  chatId: string;
  approvalId: number;
  contactName: string;
  contactMessage: string;
  contactMeta: string;
  draft: string;
}): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = `<b>📬 Nouveau lead</b>\n\n<b>${escape(input.contactName)}</b> vous a écrit :\n\n<i>« ${escape(input.contactMessage).slice(0, 500)} »</i>\n\n${input.contactMeta ? escape(input.contactMeta) + "\n\n" : ""}<b>Brouillon IA :</b>\n<code>${escape(input.draft).slice(0, 2500)}</code>\n\n<i>Valide ou ajuste ci-dessous ↓</i>`;

  try {
    const r = await fetch(`https://api.telegram.org/bot${input.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: body,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Valider et envoyer", callback_data: `act:${input.approvalId}:approve` },
            ],
            [
              { text: "✎ Modifier avant envoi", callback_data: `act:${input.approvalId}:edit` },
              { text: "✗ Ignorer", callback_data: `act:${input.approvalId}:reject` },
            ],
          ],
        },
      }),
    });
    const json = (await r.json()) as { ok?: boolean; result?: { message_id: number }; description?: string };
    if (!json.ok || !json.result)
      return { ok: false, error: json.description ?? `HTTP ${r.status}` };
    return { ok: true, messageId: json.result.message_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur réseau Telegram" };
  }
}

// ─── Point d'entrée public : créer une demande de validation ──────
export async function createApprovalRequest(input: {
  source: ApprovalSource;
  sourceId: number;
  contactName: string;
  contactEmail: string;
  contactMessage: string;
  contactMeta?: string; // "Téléphone: ...\nLieu: ...\nDate: ..."
  language?: "fr" | "en";
}): Promise<{ ok: boolean; approvalId?: number; error?: string }> {
  // 1) Draft IA
  const draft = await draftResponse({
    contactName: input.contactName,
    contactMessage: input.contactMessage,
    contactMeta: input.contactMeta ?? "",
    language: input.language ?? "fr",
  });
  if (!draft.ok) {
    console.error("[approval-flow] draft failed:", draft.error);
    return { ok: false, error: draft.error };
  }

  // 2) Persist la demande
  let approvalId: number;
  try {
    const row = await queryOne<{ id: number }>(
      `INSERT INTO pending_approvals (
         source, source_id, contact_name, contact_email,
         original_message, contact_meta, draft_response, language
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.source,
        input.sourceId,
        input.contactName,
        input.contactEmail,
        input.contactMessage,
        input.contactMeta ?? "",
        draft.text,
        input.language ?? "fr",
      ]
    );
    if (!row) return { ok: false, error: "INSERT retourna vide" };
    approvalId = row.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "DB insert failed" };
  }

  // 3) Envoi Telegram
  const shared = await getSharedConfig().catch(() => ({} as Record<string, string>));
  const botToken = shared.telegram_bot_token;
  const chatId = shared.telegram_allowed_user_id;
  if (!botToken || !chatId) {
    console.warn("[approval-flow] Telegram non configuré, draft en attente sans notif");
    return { ok: true, approvalId };
  }

  const tg = await sendTelegramApprovalMessage({
    botToken,
    chatId,
    approvalId,
    contactName: input.contactName,
    contactMessage: input.contactMessage,
    contactMeta: input.contactMeta ?? "",
    draft: draft.text,
  });

  if (tg.ok) {
    await execute(
      `UPDATE pending_approvals SET telegram_message_id = $1 WHERE id = $2`,
      [tg.messageId, approvalId]
    ).catch(() => {});
  }

  return { ok: true, approvalId };
}

// ─── Handle callback ───────────────────────────────────────────────
// Traite un clic bouton Telegram. Renvoie le nouveau texte à afficher
// dans le message (via editMessageText côté webhook).
export async function handleApprovalCallback(input: {
  callbackData: string;
  editedText?: string; // pour l'action "edit" quand Mickael tape sa version
}): Promise<{ ok: boolean; newText: string; sentToClient?: boolean; error?: string }> {
  const parts = input.callbackData.split(":");
  if (parts.length !== 3 || parts[0] !== "act")
    return { ok: false, newText: "❌ Callback invalide.", error: "bad_format" };
  const id = parseInt(parts[1], 10);
  const action = parts[2];
  if (!Number.isFinite(id))
    return { ok: false, newText: "❌ ID invalide.", error: "bad_id" };

  const row = await queryOne<{
    contact_name: string;
    contact_email: string;
    original_message: string;
    draft_response: string;
    language: string;
    status: string;
  }>(
    `SELECT contact_name, contact_email, original_message, draft_response, language, status
     FROM pending_approvals WHERE id = $1`,
    [id]
  );
  if (!row) return { ok: false, newText: "❌ Demande introuvable.", error: "not_found" };
  if (row.status !== "pending" && action !== "edit")
    return { ok: false, newText: `⚠️ Déjà traitée (${row.status}).`, error: "already_done" };

  if (action === "reject") {
    await execute(
      `UPDATE pending_approvals SET status = 'rejected', decided_at = NOW() WHERE id = $1`,
      [id]
    );
    return {
      ok: true,
      newText: `✗ Ignoré · ${row.contact_name} — aucun envoi.`,
    };
  }

  if (action === "approve" || action === "edit") {
    const finalText =
      action === "edit" && input.editedText ? input.editedText : row.draft_response;

    // Envoi email
    const subject =
      row.language === "en"
        ? `Re: your message on romerophotography.fr`
        : `Re : votre message sur romerophotography.fr`;
    const mail = await sendMail({
      to: row.contact_email,
      subject,
      text: finalText,
      // On envoie en simple text ; le mailer peut wrap en HTML si besoin
    }).catch((e) => ({ sent: false as const, error: e instanceof Error ? e.message : "?" }));

    await execute(
      `UPDATE pending_approvals
       SET status = $1, sent_response = $2, decided_at = NOW(), sent_at = NOW()
       WHERE id = $3`,
      [mail.sent ? "sent" : "sent_failed", finalText, id]
    );

    if (!mail.sent) {
      return {
        ok: false,
        newText: `⚠️ Envoi email échoué pour ${row.contact_name} : ${
          "error" in mail ? mail.error : "?"
        }`,
        sentToClient: false,
      };
    }
    return {
      ok: true,
      newText: `✅ Envoyé à ${row.contact_name} (${row.contact_email})\n\nRéponse : ${finalText.slice(0, 300)}${finalText.length > 300 ? "…" : ""}`,
      sentToClient: true,
    };
  }

  return { ok: false, newText: "❌ Action inconnue.", error: "unknown_action" };
}
