"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Props = {
  /** Current photo URL (DB override or hardcoded default). */
  currentUrl: string;
  /** Hint shown beneath the preview. */
  caption?: string;
  /** Aspect ratio of the preview frame. */
  ratio?: string;
  /** Live-save action that stores the URL into page_content. */
  saveAction: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Inline photo replacer for the home hero (or any other one-off photo).
 *
 * Client → Blob direct upload, then live-saves the resulting URL via the
 * given Server Action. Same pattern as the gallery uploads — no file
 * bytes flow through our Server Action, so Vercel's 4.5 MB serverless
 * cap is irrelevant.
 */
export default function HeroPhotoUploader({
  currentUrl,
  caption,
  ratio = "4 / 5",
  saveAction,
}: Props) {
  const [url, setUrl] = useState(currentUrl);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleFile(f: File) {
    setStatus({ kind: "uploading", name: f.name });
    try {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const pathname = `posts/hero-${ts}-${safe}`;
      const blob = await upload(pathname, f, {
        access: "public",
        handleUploadUrl: "/api/blob/upload-token",
      });
      setStatus({ kind: "saving" });
      const res = await saveAction(blob.url);
      if (res.ok) {
        setUrl(blob.url);
        setStatus({ kind: "saved" });
        setTimeout(() => setStatus({ kind: "idle" }), 1800);
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const pill = (() => {
    switch (status.kind) {
      case "idle":      return null;
      case "uploading": return { color: "var(--gold-deep)",  text: `⏳ Téléversement de ${status.name}…` };
      case "saving":    return { color: "var(--muted)",       text: "Enregistrement…" };
      case "saved":     return { color: "var(--sage-deep)",   text: "✓ Enregistré" };
      case "error":     return { color: "#8B2E2E",            text: `❌ ${status.message}` };
    }
  })();

  return (
    <div className="hero-photo-uploader">
      <div className="hero-photo-uploader__preview" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Photo hero" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <label className="hero-photo-uploader__overlay">
          {status.kind === "uploading" ? "⏳ Envoi…" : "📷 Remplacer la photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={status.kind === "uploading" || status.kind === "saving"}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) handleFile(f);
            }}
          />
        </label>
      </div>
      <div className="hero-photo-uploader__foot">
        {caption && <span className="cover-picker__hint">{caption}</span>}
        {pill && (
          <span style={{ fontSize: 11.5, fontWeight: 500, color: pill.color }}>{pill.text}</span>
        )}
      </div>
    </div>
  );
}
