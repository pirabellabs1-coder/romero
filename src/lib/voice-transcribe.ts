// ──────────────────────────────────────────────────────────────────────
// Transcription vocale via OpenAI Whisper API
// ──────────────────────────────────────────────────────────────────────
//
// Utilisé par les webhooks Telegram et WhatsApp pour convertir les
// vocaux entrants en texte avant de les passer à Claude.
//
// Design :
//   - Reçoit une URL de fichier audio + une clé API OpenAI
//   - Télécharge le fichier, l'envoie à /v1/audio/transcriptions
//   - Force le français pour éviter que Whisper hallucine une langue
//     étrangère sur les vocaux courts
//   - Renvoie un texte trimmé ou une erreur typée
//
// Note : Whisper accepte jusqu'à 25 MB. Les vocaux WhatsApp/Telegram
// dépassent rarement 5 MB (compression Opus). Aucun chunking nécessaire.

const OPENAI_TRANSCRIBE = "https://api.openai.com/v1/audio/transcriptions";
const MODEL = "whisper-1"; // stable et pas cher (~0.006$/min)

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

    // 3. Construit le multipart form-data manuellement (FormData natif
    // Node 20 fonctionne dans le runtime Vercel).
    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: guessContentType(filename) }),
      filename
    );
    form.append("model", MODEL);
    form.append("language", input.language ?? "fr");
    form.append("response_format", "json");
    if (input.prompt) form.append("prompt", input.prompt);

    // 4. Appel Whisper
    const resp = await fetch(OPENAI_TRANSCRIBE, {
      method: "POST",
      headers: { authorization: `Bearer ${input.apiKey}` },
      body: form,
    });
    if (!resp.ok) {
      const text = await resp.text();
      return {
        ok: false,
        error: `Whisper HTTP ${resp.status} · ${text.slice(0, 300)}`,
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
