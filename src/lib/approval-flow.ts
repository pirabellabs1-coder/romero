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

// ─── Échappement HTML pour Telegram (parse_mode: "HTML") ───────────
// Un « < » ou « & » non échappé dans un nom / email / texte → Telegram
// répond 400 « can't parse entities » et le message n'est jamais mis à
// jour. On échappe TOUTE portion dynamique interpolée dans un newText.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
  const body = `<b>📬 Nouveau lead</b>\n\n<b>${escapeHtml(input.contactName)}</b> vous a écrit :\n\n<i>« ${escapeHtml(input.contactMessage.slice(0, 500))} »</i>\n\n${input.contactMeta ? escapeHtml(input.contactMeta) + "\n\n" : ""}<b>Brouillon IA :</b>\n<code>${escapeHtml(input.draft.slice(0, 2500))}</code>\n\n<i>Valide ou ajuste ci-dessous ↓</i>`;

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
  } else {
    // Draft persisté mais notif Telegram KO : on le log clairement plutôt
    // que de renvoyer un ok silencieux trompeur.
    console.warn(
      `[approval-flow] Envoi Telegram échoué (draft #${approvalId} en attente sans notif):`,
      tg.error
    );
  }

  return { ok: true, approvalId };
}

// ─── Handle callback ───────────────────────────────────────────────
// Traite un clic bouton Telegram (ou une action web). Renvoie le nouveau
// texte à afficher dans le message (via editMessageText côté webhook).
//
// Actions :
//   approve   — envoie le brouillon IA tel quel        (depuis 'pending')
//   reject    — ignore, aucun envoi                     (depuis 'pending')
//   edit      — ENTRE en mode édition (aucun envoi)     (depuis 'pending')
//               → renvoie awaitEdit:true ; le webhook envoie un force_reply
//   sendedit  — envoie la version corrigée de Mickael   (depuis 'edited_pending')
export async function handleApprovalCallback(input: {
  callbackData: string;
  editedText?: string; // pour "sendedit" : la version tapée par Mickael
}): Promise<{
  ok: boolean;
  newText: string;
  sentToClient?: boolean;
  awaitEdit?: boolean;
  error?: string;
}> {
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

  // ── reject ──────────────────────────────────────────────────────
  if (action === "reject") {
    // Atomique : ne rejette que si encore en attente (évite d'écraser un envoi).
    const claimed = await queryOne<{ id: number }>(
      `UPDATE pending_approvals SET status = 'rejected', decided_at = NOW()
       WHERE id = $1 AND status IN ('pending','edited_pending') RETURNING id`,
      [id]
    );
    if (!claimed)
      return { ok: false, newText: `⚠️ Déjà traitée (${row.status}).`, error: "already_done" };
    return { ok: true, newText: `✗ Ignoré · ${escapeHtml(row.contact_name)} — aucun envoi.` };
  }

  // ── edit : passe en mode édition, N'ENVOIE RIEN ─────────────────
  // (corrige le bug critique : l'ancien code envoyait le brouillon non
  //  modifié parce qu'aucun editedText n'était jamais fourni.)
  if (action === "edit") {
    const claimed = await queryOne<{ id: number }>(
      `UPDATE pending_approvals SET status = 'edited_pending'
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );
    if (!claimed)
      return { ok: false, newText: `⚠️ Déjà traitée (${row.status}).`, error: "already_done" };
    return {
      ok: true,
      awaitEdit: true,
      newText: `✎ Édition en cours · ${escapeHtml(row.contact_name)}\n\nRéponds à ce message avec ta version corrigée, je l'enverrai telle quelle.`,
    };
  }

  // ── approve / sendedit : envoi de l'email ───────────────────────
  if (action === "approve" || action === "sendedit") {
    const isEdited = action === "sendedit";
    const finalText =
      isEdited && input.editedText?.trim() ? input.editedText.trim() : row.draft_response;

    // Claim ATOMIQUE avant l'envoi : seul le premier callback concurrent
    // passe (empêche le double-envoi sur double-tap). On pose 'sent'
    // optimiste ; on corrigera en 'sent_failed' si l'email échoue.
    const allowed = isEdited ? "edited_pending" : "pending";
    const claimed = await queryOne<{ id: number }>(
      `UPDATE pending_approvals
         SET status = 'sent', sent_response = $2, decided_at = NOW(), sent_at = NOW()
       WHERE id = $1 AND status = $3 RETURNING id`,
      [id, finalText, allowed]
    );
    if (!claimed)
      return { ok: false, newText: `⚠️ Déjà traitée (${row.status}).`, error: "already_done" };

    const subject =
      row.language === "en"
        ? `Re: your message on romerophotography.fr`
        : `Re : votre message sur romerophotography.fr`;
    const mail = await sendMail({
      to: row.contact_email,
      subject,
      text: finalText,
    }).catch((e) => ({ sent: false as const, error: e instanceof Error ? e.message : "?" }));

    if (!mail.sent) {
      await execute(
        `UPDATE pending_approvals SET status = 'sent_failed' WHERE id = $1`,
        [id]
      ).catch(() => {});
      return {
        ok: false,
        newText: `⚠️ Envoi email échoué pour ${escapeHtml(row.contact_name)} : ${escapeHtml(
          String("error" in mail ? mail.error : "?")
        )}`,
        sentToClient: false,
      };
    }
    return {
      ok: true,
      newText: `✅ Envoyé à ${escapeHtml(row.contact_name)} (${escapeHtml(row.contact_email)})${
        isEdited ? " · version modifiée" : ""
      }\n\nRéponse : ${escapeHtml(finalText.slice(0, 300))}${finalText.length > 300 ? "…" : ""}`,
      sentToClient: true,
    };
  }

  return { ok: false, newText: "❌ Action inconnue.", error: "unknown_action" };
}

// ─── Édition via force_reply ───────────────────────────────────────
// Quand Mickael clique « ✎ Modifier », le webhook envoie un message
// force_reply et enregistre ICI son message_id, pour pouvoir relier la
// réponse texte de Mickael à la bonne demande. On réutilise la colonne
// telegram_message_id (l'ancien message d'approbation n'est plus édité).
export async function markEditPromptSent(
  approvalId: number,
  promptMessageId: number
): Promise<void> {
  await execute(
    `UPDATE pending_approvals SET telegram_message_id = $1
     WHERE id = $2 AND status = 'edited_pending'`,
    [promptMessageId, approvalId]
  ).catch(() => {});
}

// Cherche une demande en attente d'édition dont le prompt force_reply
// correspond au message auquel Mickael vient de répondre.
export async function findEditPendingByReply(
  replyToMessageId: number
): Promise<{ id: number } | null> {
  return queryOne<{ id: number }>(
    `SELECT id FROM pending_approvals
     WHERE telegram_message_id = $1 AND status = 'edited_pending'
     ORDER BY id DESC LIMIT 1`,
    [replyToMessageId]
  );
}
