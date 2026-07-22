// ──────────────────────────────────────────────────────────────────────
// Transcription vocale — Groq Whisper (défaut) ou OpenAI Whisper (fallback)
// ──────────────────────────────────────────────────────────────────────
//
// Utilisé par les webhooks Telegram et WhatsApp pour convertir les
// vocaux entrants en texte avant de les passer à Claude.
//
// Priorité :
//   1. Si GROQ_API_KEY est défini → Groq whisper-large-v3-turbo (rapide + gratuit)
//   2. Sinon → OpenAI Whisper avec la clé de l'utilisateur (payant)
//
// Note : les deux APIs sont compatibles OpenAI (même format multipart,
// mêmes params). Seul l'endpoint et le nom du modèle changent.
// Whisper accepte jusqu'à 25 MB — vocaux WA/TG rarement > 5 MB.

const OPENAI_TRANSCRIBE = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_MODEL = "whisper-1";
const GROQ_TRANSCRIBE = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo"; // rapide, gratuit, qualité française excellente

export type TranscribeResult =
  | { ok: true; text: string; duration_ms: number }
  | { ok: false; error: string };

// Télécharge un fichier depuis une URL puis l'envoie à Whisper.
// Les webhooks Telegram/WhatsApp fournissent des URLs signées avec
// leur propre token — on ajoute optionnellement un header `authorization`
// pour ces cas-là.
export async function transcribeAudioUrl(input: {
  apiKey: string;
  audioUrl: string;
  fetchHeaders?: Record<string, string>;
  language?: string; // ISO-639-1, défaut 'fr'
  prompt?: string; // biais lexical (ex: noms propres, jargon métier)
  filenameHint?: string; // pour l'extension MIME
}): Promise<TranscribeResult> {
  const t0 = Date.now();
  try {
    // 1. Télécharge l'audio
    const audioResp = await fetch(input.audioUrl, {
      headers: input.fetchHeaders,
    });
    if (!audioResp.ok) {
      return {
        ok: false,
        error: `Téléchargement audio échoué : HTTP ${audioResp.status}`,
      };
    }
    const audioBuffer = await audioResp.arrayBuffer();
    if (audioBuffer.byteLength === 0)
      return { ok: false, error: "Fichier audio vide" };
    if (audioBuffer.byteLength > 25 * 1024 * 1024)
      return { ok: false, error: "Audio > 25 MB (limite Whisper)" };

    // 2. Détermine un nom de fichier avec extension — Whisper l'utilise
    // pour deviner le format quand le MIME n'est pas explicite.
    const filename =
      input.filenameHint ||
      inferFilenameFromUrl(input.audioUrl) ||
      "audio.ogg";

    // 3. Choix du provider : Groq prioritaire si sa clé est en ENV,
    // sinon OpenAI avec la clé fournie par l'utilisateur.
    const groqKey = process.env.GROQ_API_KEY?.replace(/^﻿/, "").trim();
    const useGroq = Boolean(groqKey);
    const endpoint = useGroq ? GROQ_TRANSCRIBE : OPENAI_TRANSCRIBE;
    const model = useGroq ? GROQ_MODEL : OPENAI_MODEL;
    const authKey = useGroq ? groqKey! : input.apiKey;

    // 4. Construit le multipart form-data (compatible OpenAI et Groq).
    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: guessContentType(filename) }),
      filename
    );
    form.append("model", model);
    form.append("language", input.language ?? "fr");
    form.append("response_format", "json");
    if (input.prompt) form.append("prompt", input.prompt);

    // 5. Appel API
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${authKey}` },
      body: form,
    });
    if (!resp.ok) {
      const text = await resp.text();
      const provider = useGroq ? "Groq" : "OpenAI";
      return {
        ok: false,
        error: `${provider} Whisper HTTP ${resp.status} · ${text.slice(0, 300)}`,
      };
    }
    const data = (await resp.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    if (!text) return { ok: false, error: "Transcription vide" };
    return { ok: true, text, duration_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function inferFilenameFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").pop() || "";
    if (last.includes(".")) return last;
    return null;
  } catch {
    return null;
  }
}

function guessContentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  switch (ext) {
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "webm":
      return "audio/webm";
    case "aac":
      return "audio/aac";
    default:
      return "application/octet-stream";
  }
}
