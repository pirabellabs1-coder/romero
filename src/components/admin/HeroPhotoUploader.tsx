"use client";
import { useState } from "react";
import { uploadToStorage } from "@/lib/storage-client";
import FocalPointPicker from "@/components/admin/FocalPointPicker";

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
  /** Live-save action for the URL. */
  saveAction: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;

  // ── Optional focal point support ─────────────────────────────────
  /**
   * If provided, a focal-point picker appears under the photo and the
   * preview applies the chosen position (live preview). The current
   * value is shown in % (or named position).
   */
  currentFocal?: string;
  /** Live-save action for the focal point (called on mouseup). */
  saveFocalAction?: (focal: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Inline photo replacer + focal-point picker (when enabled).
 *
 * Client → Blob direct upload for the URL, then live-saves URL and/or
 * focal point via the given Server Actions. The picker uses the same
 * click-on-image pattern as the gallery covers — drag the gold marker
 * to set which part of the photo must stay visible after cropping.
 */
export default function HeroPhotoUploader({
  currentUrl,
  caption,
  ratio = "4 / 5",
  saveAction,
  currentFocal,
  saveFocalAction,
}: Props) {
  const [url, setUrl] = useState(currentUrl);
  const [focal, setFocal] = useState(currentFocal || "center center");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [focalStatus, setFocalStatus] = useState<Status>({ kind: "idle" });

  async function handleFile(f: File) {
    setStatus({ kind: "uploading", name: f.name });
    try {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const pathname = `content/hero-${ts}-${safe}`;
      const { publicUrl } = await uploadToStorage(pathname, f);
      setStatus({ kind: "saving" });
      const res = await saveAction(publicUrl);
      if (res.ok) {
        setUrl(publicUrl);
        setStatus({ kind: "saved" });
        setTimeout(() => setStatus({ kind: "idle" }), 1800);
      } else {
        setStatus({ kind: "error", message: res.error });
      }
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function handleFocalChange(next: string) {
    setFocal(next);
    if (!saveFocalAction) return;
    setFocalStatus({ kind: "saving" });
    const res = await saveFocalAction(next);
    if (res.ok) {
      setFocalStatus({ kind: "saved" });
      setTimeout(() => setFocalStatus({ kind: "idle" }), 1800);
    } else {
      setFocalStatus({ kind: "error", message: res.error });
    }
  }

  function pillOf(s: Status) {
    switch (s.kind) {
      case "idle":      return null;
      case "uploading": return { color: "var(--gold-deep)",  text: `⏳ Téléversement de ${s.name}…`, bg: "rgba(184,151,90,.12)" };
      case "saving":    return { color: "var(--muted)",       text: "Enregistrement…", bg: "rgba(0,0,0,.04)" };
      case "saved":     return { color: "var(--sage-deep)",   text: "✓ Enregistré", bg: "rgba(157,178,154,.18)" };
      case "error":     return { color: "#8B2E2E",            text: `❌ ${s.message}`, bg: "rgba(139,46,46,.08)" };
    }
  }
  const pill = pillOf(status);
  const focalPill = pillOf(focalStatus);

  // Floating toast on the photo whenever a focal-point or upload save lands.
  // Disappears in 1.6s. Shown ONLY for saved/error states so it doesn't
  // distract during normal interaction.
  const showFocalToast = focalStatus.kind === "saved" || focalStatus.kind === "error" || focalStatus.kind === "saving";
  const showUrlToast = status.kind === "saved" || status.kind === "error";

  const focalEnabled = Boolean(saveFocalAction);

  return (
    <div className="hero-photo-uploader">
      {focalEnabled ? (
        // Focal point mode: the FocalPointPicker IS the preview. Clicking
        // anywhere on the image moves the gold marker; releasing commits.
        <div style={{ position: "relative" }}>
          <FocalPointPicker
            src={url}
            value={focal}
            ratio={ratio}
            onChange={handleFocalChange}
          />
          {/* Floating "saved/saving" toast over the photo — much more
              prominent than the small pill in the foot. Disappears auto. */}
          {(showFocalToast || showUrlToast) && (focalPill || pill) && (
            <div
              style={{
                position: "absolute",
                top: 10, right: 10,
                padding: "8px 14px",
                background: ((showFocalToast ? focalPill : pill) || pill)?.bg,
                color: ((showFocalToast ? focalPill : pill) || pill)?.color,
                border: `1px solid ${((showFocalToast ? focalPill : pill) || pill)?.color}`,
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.4,
                pointerEvents: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                backdropFilter: "blur(6px)",
              }}
            >
              {showFocalToast ? `Cadrage ${focalPill?.text}` : pill?.text}
            </div>
          )}
          <label className="hero-photo-uploader__overlay" style={{ borderRadius: "0 0 4px 4px" }}>
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
      ) : (
        // Legacy plain-preview mode (no focal point control).
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
      )}
      <div className="hero-photo-uploader__foot">
        {caption && <span className="cover-picker__hint">{caption}</span>}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {focalPill && (
            <span style={{ fontSize: 11.5, fontWeight: 500, color: focalPill.color }}>
              Cadrage : {focalPill.text}
            </span>
          )}
          {pill && (
            <span style={{ fontSize: 11.5, fontWeight: 500, color: pill.color }}>{pill.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}
