/**
 * POST /api/telegram/webhook
 * ────────────────────────────────────────────────────────────────────
 * Reçoit un update Telegram depuis l'API Bot. Fait passer le message
 * (texte OU vocal transcrit) à l'assistant partagé, puis répond à
 * l'utilisateur via l'API sendMessage.
 *
 * Configuration côté Telegram :
 *   Une fois le bot créé via @BotFather, il faut lui indiquer notre URL :
 *     curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://romerophotography.fr/api/telegram/webhook&secret_token=<SECRET>"
 *
 * Sécurité :
 *   - Filtre les updates non-message et les messages non-privés
 *   - Vérifie l'ID utilisateur autorisé (telegram_allowed_user_id) si
 *     renseigné dans la config. Sinon accepte tout expéditeur (utile
 *     pour les tests).
 *
 * Vocaux :
 *   - Télécharge le fichier via getFile → download URL
 *   - Whisper le transcrit
 *   - Le texte final est envoyé à l'assistant
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/lib/agents";
import { runAssistant } from "@/lib/whatsapp-assistant";
import { transcribeAudioUrl } from "@/lib/voice-transcribe";
import { writeSharedKey } from "@/lib/studio-settings";
import {
  handleApprovalCallback,
  markEditPromptSent,
  findEditPendingByReply,
} from "@/lib/approval-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Types Telegram (subset)
type TelegramUpdate = {
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string };
    audio?: { file_id: string; duration: number; mime_type?: string };
    reply_to_message?: { message_id: number };
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
};

async function tg(token: string, method: string, body: unknown) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return resp.json();
}

async function sendReply(token: string, chatId: number, text: string) {
  // Telegram limite à 4096 caractères par message. On chunke si dépassement.
  const chunks = chunkString(text, 3800);
  for (const c of chunks) {
    await tg(token, "sendMessage", {
      chat_id: chatId,
      text: c,
      disable_web_page_preview: true,
    });
  }
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

// Filet de sécurité : retire les marqueurs markdown même si l'IA en
// glisse malgré la consigne système. Telegram sans parse_mode affiche
// les astérisques tels quels, ce qui pollue le rendu.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

async function downloadTelegramFile(
  token: string,
  fileId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const info = (await tg(token, "getFile", { file_id: fileId })) as {
    ok: boolean;
    result?: { file_path: string };
    description?: string;
  };
  if (!info.ok || !info.result) {
    return { ok: false, error: info.description || "getFile failed" };
  }
  return {
    ok: true,
    url: `https://api.telegram.org/file/bot${token}/${info.result.file_path}`,
  };
}

export async function POST(req: NextRequest) {
  // ACK rapidement : Telegram considère timeout > 60s comme retry. On
  // envoie 200 dès qu'on a validé le format, et on répond à l'utilisateur
  // via sendMessage dans le même handler (Telegram s'en fiche du body).
  try {
    const update = (await req.json().catch(() => null)) as TelegramUpdate | null;

    // ─── callback_query : clic sur un bouton d'approbation ─────────────
    if (update?.callback_query) {
      const cq = update.callback_query;
      const inst = await getAgent("whatsapp");
      const cfg = (inst?.config ?? {}) as {
        telegram_bot_token?: string;
        telegram_allowed_user_id?: string;
      };
      const token = cfg.telegram_bot_token;
      if (!token) return NextResponse.json({ ok: true, ignored: "no_token" });

      // ACK immédiat pour retirer l'animation de loading côté client
      await tg(token, "answerCallbackQuery", { callback_query_id: cq.id }).catch(() => {});

      // Filtre user autorisé
      const allowedId = cfg.telegram_allowed_user_id?.trim();
      const fromId = String(cq.from.id);
      if (allowedId && fromId !== allowedId) {
        return NextResponse.json({ ok: true, ignored: "unauthorized_callback" });
      }

      if (!cq.data || !cq.message) {
        return NextResponse.json({ ok: true, ignored: "no_data" });
      }

      const result = await handleApprovalCallback({ callbackData: cq.data });
      // Édite le message d'origine pour refléter la nouvelle situation et
      // RETIRE les boutons (inline_keyboard vide) — évite les double-clics.
      await tg(token, "editMessageText", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        text: result.newText,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      }).catch(() => {});

      // Mode édition : on envoie un message force_reply pour capturer la
      // version corrigée de Mickael, et on mémorise son message_id afin de
      // relier sa future réponse à cette demande précise.
      if (result.awaitEdit) {
        const idPart = cq.data.split(":")[1];
        const approvalId = parseInt(idPart, 10);
        const prompt = await tg(token, "sendMessage", {
          chat_id: cq.message.chat.id,
          text: "✎ Tape ta version corrigée en RÉPONDANT à ce message. Je l'enverrai telle quelle au client.",
          reply_markup: { force_reply: true, input_field_placeholder: "Ta réponse au client…" },
        }).catch(() => null);
        const promptId = (prompt as { result?: { message_id?: number } } | null)?.result
          ?.message_id;
        if (Number.isFinite(approvalId) && typeof promptId === "number") {
          await markEditPromptSent(approvalId, promptId);
        }
      }

      return NextResponse.json({ ok: true, action: cq.data, result: result.ok });
    }

    const msg = update?.message;
    if (!msg || msg.chat.type !== "private") {
      return NextResponse.json({ ok: true, ignored: "no_message_or_not_private" });
    }

    const inst = await getAgent("whatsapp");
    const cfg = (inst?.config ?? {}) as {
      telegram_bot_token?: string;
      telegram_allowed_user_id?: string;
      openai_api_key?: string;
    };
    const token = cfg.telegram_bot_token;
    if (!token) {
      // On ne peut pas répondre sans token, on log et exit.
      console.warn("[telegram] webhook fired but no token in config");
      return NextResponse.json({ ok: true, ignored: "no_token" });
    }

    // Filtre user autorisé, avec AUTO-CAPTURE au premier /start
    // ─────────────────────────────────────────────────────────
    // Si aucun user autorisé n'est encore enregistré et que le message
    // reçu est /start, on considère l'expéditeur comme le propriétaire
    // (pattern "premier utilisateur wins") — évite au user d'aller
    // chercher son ID sur @userinfobot manuellement.
    const fromId = String(msg.from?.id ?? "");
    const allowedId = cfg.telegram_allowed_user_id?.trim();
    if (!allowedId && fromId && msg.text?.trim().startsWith("/start")) {
      await writeSharedKey("telegram_allowed_user_id", fromId);
      await sendReply(
        token,
        msg.chat.id,
        `👋 Bonjour ${msg.from?.first_name || "Mickael"} ! Je suis votre assistant Romero Studio.\n\nJe viens de vous enregistrer comme utilisateur autorisé (ID Telegram : ${fromId}). À partir de maintenant, envoyez-moi n'importe quel message ou vocal et je m'occupe de votre agenda.\n\nExemples :\n• « Prends RDV visio demain 15h avec Sophie »\n• « Suis-je libre samedi entre 14h et 18h ? »\n• Vocal : décrivez le RDV, je crée l'événement.`
      );
      return NextResponse.json({ ok: true, captured_owner: fromId });
    }
    if (allowedId && fromId !== allowedId) {
      await sendReply(
        token,
        msg.chat.id,
        "Bonjour ! Ce bot est réservé à un usage personnel. Merci de contacter Mickael Romero via https://romerophotography.fr/contact si vous cherchez à échanger avec lui."
      );
      return NextResponse.json({ ok: true, ignored: "unauthorized_user" });
    }

    // ─── Capture d'une édition de réponse client ──────────────────
    // Si Mickael RÉPOND au message force_reply « ✎ Modifier », son texte
    // EST la version corrigée à envoyer au client. On l'intercepte AVANT
    // l'assistant IA (sinon il serait traité comme une demande d'agenda).
    if (msg.reply_to_message?.message_id && msg.text?.trim()) {
      const pending = await findEditPendingByReply(msg.reply_to_message.message_id);
      if (pending) {
        const res = await handleApprovalCallback({
          callbackData: `act:${pending.id}:sendedit`,
          editedText: msg.text,
        });
        // newText est déjà échappé HTML par handleApprovalCallback : on
        // l'envoie AVEC parse_mode HTML (comme le chemin bouton) pour que les
        // entités (&amp; &lt; &gt;) s'affichent correctement au lieu d'être
        // rendues littéralement par un envoi texte brut.
        await tg(token, "sendMessage", {
          chat_id: msg.chat.id,
          text: res.newText,
          parse_mode: "HTML",
        });
        return NextResponse.json({ ok: true, sent_edit: pending.id, result: res.ok });
      }
    }

    // ─── Commandes système (avant le passage à l'assistant IA) ────
    const cmd = msg.text?.trim().toLowerCase();
    if (cmd === "/status" || cmd === "/etat") {
      const statusText = await buildStatusReport();
      await tg(token, "sendMessage", {
        chat_id: msg.chat.id,
        text: statusText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      return NextResponse.json({ ok: true, command: "status" });
    }
    if (cmd === "/help" || cmd === "/aide") {
      await sendReply(
        token,
        msg.chat.id,
        `📋 Commandes disponibles :

/status — récap du jour (RDV, leads, approvals)
/help — cette aide

Sinon, écris ou envoie un vocal :
• « Prends RDV visio demain 15h avec Sophie »
• « Suis-je libre samedi entre 14h et 18h ? »
• « Récap de la semaine »

Les nouveaux leads arrivent automatiquement ici avec un brouillon IA à valider en 1 clic. ✨`
      );
      return NextResponse.json({ ok: true, command: "help" });
    }

    // Récupère le texte (message texte ou vocal transcrit)
    let userText = "";
    if (msg.text) {
      userText = msg.text;
    } else if (msg.voice || msg.audio) {
      if (!cfg.openai_api_key) {
        await sendReply(
          token,
          msg.chat.id,
          "🎤 Vous m'avez envoyé un vocal, mais la transcription n'est pas configurée. Ajoutez votre clé API OpenAI dans /admin/agents/whatsapp → Configuration."
        );
        return NextResponse.json({ ok: true, error: "no_openai_key" });
      }
      const media = msg.voice || msg.audio;
      const file = await downloadTelegramFile(token, media!.file_id);
      if (!file.ok) {
        await sendReply(token, msg.chat.id, `Impossible de récupérer le fichier audio : ${file.error}`);
        return NextResponse.json({ ok: true, error: file.error });
      }
      // Indicateur "typing" pendant la transcription
      tg(token, "sendChatAction", { chat_id: msg.chat.id, action: "typing" }).catch(() => {});
      const transcribed = await transcribeAudioUrl({
        apiKey: cfg.openai_api_key,
        audioUrl: file.url,
        language: "fr",
        filenameHint: "voice.ogg",
      });
      if (!transcribed.ok) {
        const friendly = /429|quota|insufficient/i.test(transcribed.error)
          ? "Transcription vocale indisponible pour le moment (quota API épuisé). Tape ton message en texte, je gère."
          : `Transcription échouée : ${transcribed.error}`;
        await sendReply(token, msg.chat.id, friendly);
        return NextResponse.json({ ok: true, error: transcribed.error });
      }
      userText = transcribed.text;
      // Confirme la transcription au user
      await sendReply(token, msg.chat.id, `🎤 J'ai compris : « ${userText} »`);
    } else {
      await sendReply(
        token,
        msg.chat.id,
        "Envoyez-moi un message texte ou un vocal — je gère votre agenda."
      );
      return NextResponse.json({ ok: true });
    }

    // Indicateur "typing" pendant que Claude réfléchit
    tg(token, "sendChatAction", { chat_id: msg.chat.id, action: "typing" }).catch(() => {});

    const result = await runAssistant({
      platform: "telegram",
      platformUserId: fromId,
      displayName: msg.from?.first_name || msg.from?.username || null,
      message: userText,
    });

    if (!result.ok) {
      await sendReply(
        token,
        msg.chat.id,
        `Désolé, j'ai rencontré une erreur : ${result.error}`
      );
      return NextResponse.json({ ok: false, error: result.error });
    }

    await sendReply(token, msg.chat.id, stripMarkdown(result.reply));
    return NextResponse.json({ ok: true, tools_used: result.tools_used });
  } catch (e) {
    console.error("[telegram/webhook]", e);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

// ─── /status : rapport du jour pour Mickael ─────────────────────────
async function buildStatusReport(): Promise<string> {
  const { queryOne, query } = await import("@/lib/db");
  const now = new Date();
  const nowStr = now.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const [pendingApprovals, unreadContacts, chatLeads, upcomingEvents, nextWedding] =
    await Promise.all([
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM pending_approvals WHERE status = 'pending'`
      ).catch(() => null),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM messages WHERE read_at IS NULL`
      ).catch(() => null),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM chat_conversations WHERE notified = FALSE`
      ).catch(() => null),
      queryOne<{ c: number }>(
        `SELECT COUNT(*)::int as c FROM assistant_events
         WHERE event_type = 'google_event_created'
         AND created_at >= NOW() - INTERVAL '7 days'`
      ).catch(() => null),
      queryOne<{ names: string; wedding_date: string; days_until: number }>(
        `SELECT names,
                to_char(created_at, 'YYYY-MM-DD') as wedding_date,
                EXTRACT(DAY FROM (created_at - NOW()))::int as days_until
         FROM galleries
         WHERE published = 1 AND created_at > NOW()
         ORDER BY created_at ASC
         LIMIT 1`
      ).catch(() => null),
    ]);

  const lines: string[] = [];
  lines.push(`<b>📊 Récap</b> · <i>${nowStr}</i>`);
  lines.push("");
  lines.push(
    `📨 <b>Brouillons IA en attente :</b> ${pendingApprovals?.c ?? "?"}${
      (pendingApprovals?.c ?? 0) > 0 ? " — valide-les !" : ""
    }`
  );
  lines.push(`✉ <b>Messages contact non lus :</b> ${unreadContacts?.c ?? "?"}`);
  lines.push(`◉ <b>Leads chatbot en attente :</b> ${chatLeads?.c ?? "?"}`);
  lines.push(`📅 <b>Événements créés cette semaine :</b> ${upcomingEvents?.c ?? "?"}`);
  if (nextWedding?.names) {
    lines.push("");
    lines.push(
      `💒 <b>Prochain mariage :</b> ${nextWedding.names} (${nextWedding.wedding_date})`
    );
  }
  lines.push("");
  lines.push(
    `<a href="https://romerophotography.fr/admin">🩺 Ouvrir le dashboard</a>`
  );
  return lines.join("\n");
}

// Endpoint santé (utile pour vérifier que la route est déployée)
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
