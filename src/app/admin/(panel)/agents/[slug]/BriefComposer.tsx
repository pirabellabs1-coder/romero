"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBriefAction, createBriefFromVoiceAction } from "../marketing-actions";

type Props = { allowVoice: boolean };

// Upload direct navigateur → Supabase Storage via /api/blob/upload-token
// Réutilise le même endpoint que les autres uploaders du site.
async function uploadFile(
  file: File,
  prefix: "uploads/marketing"
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${prefix}/${Date.now()}-${cleanName}`;
  try {
    const tokenResp = await fetch("/api/blob/upload-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pathname: path, contentType: file.type }),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return { ok: false, error: `Token upload : ${t.slice(0, 200)}` };
    }
    const { signedUrl, publicUrl } = (await tokenResp.json()) as {
      signedUrl: string;
      publicUrl: string;
    };
    const put = await fetch(signedUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
    if (!put.ok) {
      const t = await put.text();
      return { ok: false, error: `Upload : ${t.slice(0, 200)}` };
    }
    return { ok: true, publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function BriefComposer({ allowVoice }: Props) {
  const router = useRouter();
  const [briefText, setBriefText] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);

  function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
    setUploadedUrls([]); // reset : on ré-upload à la soumission
  }

  function onPickVoice(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setVoiceFile(f);
  }

  async function submitTextBrief() {
    if (!briefText.trim() && photoFiles.length === 0) {
      setFlash({ ok: false, msg: "Ajoutez au moins un brief ou une photo." });
      return;
    }
    setFlash(null);
    startTransition(async () => {
      // Upload des photos
      setUploading(true);
      const urls: string[] = [];
      for (const f of photoFiles) {
        const r = await uploadFile(f, "uploads/marketing");
        if (!r.ok) {
          setFlash({ ok: false, msg: r.error });
          setUploading(false);
          return;
        }
        urls.push(r.publicUrl);
      }
      setUploadedUrls(urls);
      setUploading(false);

      const res = await createBriefAction({
        brief_text: briefText.trim() || "(Brief basé uniquement sur les photos)",
        brief_source: "text",
        photo_urls: urls,
      });
      if (!res.ok) {
        setFlash({ ok: false, msg: res.error });
      } else {
        setFlash({ ok: true, msg: "3 drafts générés." });
        setBriefText("");
        setPhotoFiles([]);
        setPhotoPreviews([]);
        setUploadedUrls([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  }

  async function submitVoiceBrief() {
    if (!voiceFile) {
      setFlash({ ok: false, msg: "Sélectionnez un fichier vocal." });
      return;
    }
    setFlash(null);
    startTransition(async () => {
      setUploading(true);
      const audioUp = await uploadFile(voiceFile, "uploads/marketing");
      if (!audioUp.ok) {
        setFlash({ ok: false, msg: audioUp.error });
        setUploading(false);
        return;
      }
      const urls: string[] = [];
      for (const f of photoFiles) {
        const r = await uploadFile(f, "uploads/marketing");
        if (!r.ok) {
          setFlash({ ok: false, msg: r.error });
          setUploading(false);
          return;
        }
        urls.push(r.publicUrl);
      }
      setUploading(false);

      const res = await createBriefFromVoiceAction({
        audio_url: audioUp.publicUrl,
        photo_urls: urls,
      });
      if (!res.ok) {
        setFlash({ ok: false, msg: res.error });
      } else {
        setFlash({ ok: true, msg: `Vocal transcrit et drafts générés.` });
        setVoiceFile(null);
        setPhotoFiles([]);
        setPhotoPreviews([]);
        if (voiceInputRef.current) voiceInputRef.current.value = "";
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  }

  const busy = pending || uploading;

  return (
    <div className="agent-panel" style={{ marginBottom: 24 }}>
      <h2>Nouveau brief</h2>
      <p style={{ marginTop: -6, marginBottom: 22 }}>
        Décrivez ce que vous voulez publier — en une phrase ou en trois
        paragraphes. L'agent génère un post Instagram (caption + hashtags),
        un post LinkedIn (ton pro), et un article de blog complet.
      </p>

      {flash ? (
        <div className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}>
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      <div className="agent-form-field">
        <label htmlFor="brief-text">Brief (texte)</label>
        <textarea
          id="brief-text"
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          placeholder={`Ex : Photo du mariage de Sophie et Marc à Saint-Paul-de-Vence, ambiance provençale, lumière dorée à l'apéritif. Envie de mettre en avant l'émotion des mariés au moment du "oui".`}
          style={{ minHeight: 120 }}
          disabled={busy}
        />
      </div>

      {/* Uploader photos */}
      <div className="agent-form-field">
        <label>Photos (optionnel, jusqu'à 5)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onPickPhotos}
          disabled={busy}
          style={{
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(184,151,90,0.22)",
            color: "rgba(244,239,227,0.85)",
            padding: 8,
            borderRadius: 4,
            width: "100%",
          }}
        />
        {photoPreviews.length > 0 ? (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {photoPreviews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`Photo ${i + 1}`}
                style={{
                  width: 90,
                  height: 90,
                  objectFit: "cover",
                  borderRadius: 4,
                  border: "1px solid rgba(184,151,90,0.35)",
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="agent-actions">
        <button
          type="button"
          className="agent-btn agent-btn--primary"
          onClick={submitTextBrief}
          disabled={busy}
        >
          {busy
            ? uploadedUrls.length < photoFiles.length && uploading
              ? "Upload des photos…"
              : "Génération en cours…"
            : "Générer les 3 drafts"}
        </button>
      </div>

      {/* Alternative vocale */}
      {allowVoice ? (
        <>
          <div
            style={{
              margin: "22px 0 18px",
              paddingTop: 18,
              borderTop: "1px solid rgba(184,151,90,0.18)",
              color: "var(--gold-light, #D4B57A)",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            ou envoyez un vocal
          </div>
          <div className="agent-form-field">
            <label>Fichier vocal (mp3, m4a, ogg, wav)</label>
            <input
              ref={voiceInputRef}
              type="file"
              accept="audio/*"
              onChange={onPickVoice}
              disabled={busy}
              style={{
                background: "rgba(0,0,0,0.22)",
                border: "1px solid rgba(184,151,90,0.22)",
                color: "rgba(244,239,227,0.85)",
                padding: 8,
                borderRadius: 4,
                width: "100%",
              }}
            />
            <span className="agent-form-field__help">
              Le vocal est transcrit puis utilisé comme brief. Les photos
              choisies au-dessus sont attachées.
            </span>
          </div>
          <div className="agent-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
            <button
              type="button"
              className="agent-btn agent-btn--primary"
              onClick={submitVoiceBrief}
              disabled={busy || !voiceFile}
            >
              {busy ? "Transcription + génération…" : "Générer depuis le vocal"}
            </button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 22, fontSize: 12, color: "var(--muted,#7A6E5C)", fontStyle: "italic" }}>
          Pour les briefs vocaux, ajoutez votre clé OpenAI dans l'onglet
          Configuration.
        </div>
      )}
    </div>
  );
}
