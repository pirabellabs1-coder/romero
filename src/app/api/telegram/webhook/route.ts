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
        await sendReply(token, msg.chat.id, `Transcription échouée : ${transcribed.error}`);
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

    await sendReply(token, msg.chat.id, result.reply);
    return NextResponse.json({ ok: true, tools_used: result.tools_used });
  } catch (e) {
    console.error("[telegram/webhook]", e);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

// Endpoint santé (utile pour vérifier que la route est déployée)
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
