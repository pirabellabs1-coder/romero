/**
 * /api/whatsapp/webhook
 * ────────────────────────────────────────────────────────────────────
 * Endpoint pour Meta WhatsApp Business Cloud API.
 *
 *   GET  → challenge de vérification lors du setup Meta.
 *          Meta envoie hub.mode + hub.verify_token + hub.challenge.
 *          On répond avec hub.challenge si le token matche notre config.
 *
 *   POST → réception d'un message entrant. On vérifie l'origine,
 *          extrait le texte (ou transcrit le vocal), fait tourner
 *          l'assistant partagé, répond via l'API Meta.
 *
 * Configuration côté Meta :
 *   Dans Meta Business → WhatsApp → Configuration :
 *   - Callback URL : https://romerophotography.fr/api/whatsapp/webhook
 *   - Verify token : la valeur qu'on met dans whatsapp_verify_token
 *   - Subscribe : messages
 *
 * Sécurité :
 *   - Verify token en GET (protection minimale contre le webhook stealing)
 *   - Filtre par whatsapp_allowed_from (numéro autorisé)
 *   - Idéalement, en prod, vérifier la signature X-Hub-Signature-256
 *     avec l'app_secret. Prévu en Phase 2 (TODO).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/lib/agents";
import { runAssistant } from "@/lib/whatsapp-assistant";
import { transcribeAudioUrl } from "@/lib/voice-transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Vérification GET (setup Meta) ────────────────────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const inst = await getAgent("whatsapp");
  const expected = (inst?.config as { whatsapp_verify_token?: string })?.whatsapp_verify_token;

  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ ok: false, error: "invalid_verify_token" }, { status: 403 });
}

// ─── Types Meta (subset) ─────────────────────────────────────────────
type MetaWebhook = {
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          timestamp: string;
          text?: { body: string };
          audio?: { id: string; mime_type?: string; voice?: boolean };
          voice?: { id: string; mime_type?: string };
        }>;
        contacts?: Array<{ profile?: { name?: string } }>;
      };
    }>;
  }>;
};

// ─── Meta API helpers ────────────────────────────────────────────────
async function metaFetch(
  phoneNumberId: string,
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string>),
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
}

async function sendWhatsAppMessage(input: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const chunks = chunkString(input.body, 3800);
  for (const c of chunks) {
    const resp = await metaFetch(input.phoneNumberId, input.accessToken, "/messages", {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: { body: c, preview_url: false },
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `HTTP ${resp.status} · ${text.slice(0, 200)}` };
    }
  }
  return { ok: true };
}

// Récupère l'URL d'un média WhatsApp (nécessite deux appels : media id → url).
async function getWhatsAppMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<{ ok: true; url: string; mime: string } | { ok: false; error: string }> {
  const resp = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    return { ok: false, error: `getMedia HTTP ${resp.status}` };
  }
  const data = (await resp.json()) as { url?: string; mime_type?: string };
  if (!data.url) return { ok: false, error: "media url manquant" };
  return { ok: true, url: data.url, mime: data.mime_type || "audio/ogg" };
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

// ─── POST : message entrant ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => null)) as MetaWebhook | null;
    if (!payload?.entry) return NextResponse.json({ ok: true });

    const inst = await getAgent("whatsapp");
    const cfg = (inst?.config ?? {}) as {
      whatsapp_phone_number_id?: string;
      whatsapp_access_token?: string;
      whatsapp_allowed_from?: string;
      openai_api_key?: string;
    };
    const pnid = cfg.whatsapp_phone_number_id;
    const token = cfg.whatsapp_access_token;
    if (!pnid || !token) {
      console.warn("[whatsapp] webhook fired but missing pnid/token");
      return NextResponse.json({ ok: true, error: "not_configured" });
    }

    const allowedFrom = cfg.whatsapp_allowed_from?.replace(/\D/g, "");

    // Meta envoie parfois plusieurs messages dans un même payload
    // (rare mais possible). On les traite tous.
    for (const entry of payload.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        for (const msg of value.messages ?? []) {
          // Numéro autorisé ?
          if (allowedFrom && msg.from !== allowedFrom) {
            await sendWhatsAppMessage({
              phoneNumberId: pnid,
              accessToken: token,
              to: msg.from,
              body:
                "Bonjour ! Ce numéro est l'assistant personnel de Mickael Romero. " +
                "Pour toute demande, merci d'utiliser le formulaire https://romerophotography.fr/contact.",
            });
            continue;
          }

          // Extrait le texte (message texte ou vocal transcrit)
          let userText = "";
          if (msg.type === "text" && msg.text?.body) {
            userText = msg.text.body;
          } else if (msg.type === "audio" && (msg.audio || msg.voice)) {
            if (!cfg.openai_api_key) {
              await sendWhatsAppMessage({
                phoneNumberId: pnid,
                accessToken: token,
                to: msg.from,
                body:
                  "🎤 Vocal reçu, mais la transcription n'est pas configurée. Ajoutez votre clé API OpenAI dans /admin/agents/whatsapp.",
              });
              continue;
            }
            const media = msg.audio || msg.voice;
            const url = await getWhatsAppMediaUrl(media!.id, token);
            if (!url.ok) {
              await sendWhatsAppMessage({
                phoneNumberId: pnid,
                accessToken: token,
                to: msg.from,
                body: `Impossible de récupérer le vocal : ${url.error}`,
              });
              continue;
            }
            const transcribed = await transcribeAudioUrl({
              apiKey: cfg.openai_api_key,
              audioUrl: url.url,
              fetchHeaders: { authorization: `Bearer ${token}` },
              language: "fr",
              filenameHint: "voice.ogg",
            });
            if (!transcribed.ok) {
              await sendWhatsAppMessage({
                phoneNumberId: pnid,
                accessToken: token,
                to: msg.from,
                body: `Transcription échouée : ${transcribed.error}`,
              });
              continue;
            }
            userText = transcribed.text;
            await sendWhatsAppMessage({
              phoneNumberId: pnid,
              accessToken: token,
              to: msg.from,
              body: `🎤 J'ai compris : « ${userText} »`,
            });
          } else {
            // Autres types (image, sticker, doc…) — non supportés en Phase 1.
            await sendWhatsAppMessage({
              phoneNumberId: pnid,
              accessToken: token,
              to: msg.from,
              body:
                "Pour l'instant je gère uniquement le texte et les vocaux. Envoyez-moi votre demande en message ou en vocal.",
            });
            continue;
          }

          // Fait tourner l'assistant
          const displayName = value.contacts?.[0]?.profile?.name || null;
          const result = await runAssistant({
            platform: "whatsapp",
            platformUserId: msg.from,
            displayName,
            message: userText,
          });

          if (!result.ok) {
            await sendWhatsAppMessage({
              phoneNumberId: pnid,
              accessToken: token,
              to: msg.from,
              body: `Désolé, j'ai rencontré une erreur : ${result.error}`,
            });
            continue;
          }

          await sendWhatsAppMessage({
            phoneNumberId: pnid,
            accessToken: token,
            to: msg.from,
            body: result.reply,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[whatsapp/webhook]", e);
    // On répond 200 pour éviter que Meta ne retry en boucle — l'erreur
    // est loguée serveur-side.
    return NextResponse.json({ ok: false, error: "internal_error" });
  }
}
