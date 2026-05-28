"use client";
import { useState, useEffect } from "react";
import { upload } from "@vercel/blob/client";
import { photoUrl } from "@/lib/photo-url";
import FocalPointPicker from "@/components/admin/FocalPointPicker";

type GalleryPhoto = { id: number; gallery_id: number; filename: string };
type GalleryWithPhotos = {
  id: number;
  names: string;
  place: string;
  photos: GalleryPhoto[];
};

type Props = {
  postId: number;
  currentCover: string | null;
  currentPosition: string;
  galleries: GalleryWithPhotos[];
  // Live-save action. The picker calls this directly whenever the cover
  // OR the focal point changes, so the photographer never has to "commit"
  // a media choice with the big ENREGISTRER button.
  saveAction: (
    postId: number,
    coverFilename: string | null,
    coverPosition: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export default function CoverPicker({ postId, currentCover, currentPosition, galleries, saveAction }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cover, setCover] = useState<string | null>(currentCover);
  const [position, setPosition] = useState(currentPosition || "center center");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Hide "Enregistré ✓" after a couple of seconds so it doesn't linger.
  useEffect(() => {
    if (status.kind !== "saved") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 1800);
    return () => clearTimeout(t);
  }, [status]);

  const previewSrc = cover ? photoUrl(cover) : null;

  async function persist(nextCover: string | null, nextPosition: string) {
    setStatus({ kind: "saving" });
    const res = await saveAction(postId, nextCover, nextPosition);
    if (res.ok) {
      setStatus({ kind: "saved" });
    } else {
      setStatus({ kind: "error", message: res.error });
    }
  }

  async function handleFileUpload(file: File) {
    setStatus({ kind: "uploading", name: file.name });
    try {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const pathname = `posts/post${postId}-${ts}-${safeName}`;
      // Client → Blob direct, bypasses Vercel's 4.5 MB serverless body cap.
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload-token",
      });
      setCover(blob.url);
      await persist(blob.url, position);
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function handleGalleryPick(filename: string) {
    setCover(filename);
    setPickerOpen(false);
    await persist(filename, position);
  }

  // Debounced status banner — small inline indicator next to the title.
  const statusBanner = (() => {
    switch (status.kind) {
      case "idle":      return null;
      case "uploading": return { color: "var(--gold-deep)",  text: `⏳ Téléversement de ${status.name}…` };
      case "saving":    return { color: "var(--muted)",       text: "Enregistrement…" };
      case "saved":     return { color: "var(--sage-deep)",   text: "✓ Enregistré" };
      case "error":     return { color: "#8B2E2E",            text: `❌ ${status.message}` };
    }
  })();

  const inputId = `cover-upload-${postId}`;

  return (
    <div className="cover-picker">
      {/* ── Status pill ───────────────────────────────────────────── */}
      <div className="cover-picker__preview-head">
        <span className="cover-picker__hint">
          Cliquez sur la photo ci-dessous pour choisir la zone à garder visible. Tout est enregistré automatiquement.
        </span>
        {statusBanner && (
          <span className="cover-picker__status" style={{ color: statusBanner.color }}>
            {statusBanner.text}
          </span>
        )}
      </div>

      {/* ── Live preview + focal point picker on the SAME image ──── */}
      {previewSrc ? (
        <FocalPointPicker
          src={previewSrc}
          value={position}
          ratio="4 / 3"
          onChange={async (next) => {
            setPosition(next);
            await persist(cover, next);
          }}
        />
      ) : (
        <div className="cover-picker__preview-frame" style={{ aspectRatio: "4 / 3", maxWidth: 380 }}>
          <div className="cover-picker__empty">
            <span>Aucune couverture</span>
            <small>Choisissez une photo ou téléversez-en une.</small>
          </div>
        </div>
      )}

      {/* ── Source: pick / upload ───────────────────────────────────── */}
      <div className="cover-picker__actions">
        <button
          type="button"
          className="cover-picker__btn"
          onClick={() => setPickerOpen(true)}
          disabled={status.kind === "uploading" || status.kind === "saving"}
        >
          📷 Choisir depuis une galerie
        </button>
        <label
          htmlFor={inputId}
          className={`cover-picker__btn cover-picker__btn--ghost${status.kind === "uploading" ? " is-disabled" : ""}`}
        >
          {status.kind === "uploading" ? "⏳ Téléversement…" : "⬆ Téléverser une nouvelle image"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          disabled={status.kind === "uploading"}
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Reset so picking the same file twice re-fires change.
            e.target.value = "";
            if (f) handleFileUpload(f);
          }}
        />
        {cover && (
          <button
            type="button"
            className="cover-picker__btn cover-picker__btn--ghost"
            onClick={async () => {
              setCover(null);
              await persist(null, position);
            }}
            disabled={status.kind === "uploading" || status.kind === "saving"}
            title="Retirer la couverture (le blog affichera un placeholder)"
          >
            ✕ Retirer
          </button>
        )}
      </div>


      {/* ── Modal: pick from gallery ────────────────────────────────── */}
      {pickerOpen && (
        <div
          className="cover-picker__modal"
          role="dialog"
          aria-label="Choisir une photo depuis une galerie"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="cover-picker__modal-inner">
            <header className="cover-picker__modal-head">
              <div>
                <h3 className="serif" style={{ margin: 0, color: "var(--forest)" }}>
                  Choisir une photo de couverture
                </h3>
                <p className="cover-picker__hint" style={{ marginTop: 4 }}>
                  Cliquez sur une photo — elle est enregistrée immédiatement.
                </p>
              </div>
              <button
                type="button"
                className="cover-picker__close"
                onClick={() => setPickerOpen(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </header>

            <div className="cover-picker__modal-body">
              {galleries.length === 0 ? (
                <p className="muted" style={{ padding: 24, textAlign: "center" }}>
                  Aucune galerie publiée avec des photos.
                </p>
              ) : (
                galleries.map((g) => (
                  <section key={g.id} className="cover-picker__gallery">
                    <h4 className="cover-picker__gallery-title">
                      <span className="serif">{g.names}</span>
                      <span className="cap-tracked-sm muted">{g.place}</span>
                    </h4>
                    <div className="cover-picker__photos">
                      {g.photos.map((p) => {
                        const url = photoUrl(p.filename);
                        const isSelected = cover === p.filename;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`cover-picker__tile${isSelected ? " is-selected" : ""}`}
                            onClick={() => handleGalleryPick(p.filename)}
                            title={p.filename.split("/").pop()}
                          >
                            {url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt="" loading="lazy" />
                            )}
                            {isSelected && <span className="cover-picker__check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
