"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { photoUrl } from "@/lib/photo-url";

type Props = {
  postId: number;
  currentCover: string | null;
  currentPosition: string;
  galleries: GalleryWithPhotos[];
};

type GalleryPhoto = { id: number; gallery_id: number; filename: string };
type GalleryWithPhotos = {
  id: number;
  names: string;
  place: string;
  photos: GalleryPhoto[];
};


const POSITION_OPTIONS = [
  { value: "left top",       label: "Haut g." },
  { value: "center top",     label: "Haut" },
  { value: "right top",      label: "Haut d." },
  { value: "left center",    label: "Gauche" },
  { value: "center center",  label: "Centre" },
  { value: "right center",   label: "Droite" },
  { value: "left bottom",    label: "Bas g." },
  { value: "center bottom",  label: "Bas" },
  { value: "right bottom",   label: "Bas d." },
];

export default function CoverPicker({ postId, currentCover, currentPosition, galleries }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // selectedFile is whatever URL/filename will be saved as the cover. It can
  // come from picking in a gallery OR from a freshly-finished client→Blob
  // upload. Either way the final submit only needs the URL.
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [position, setPosition] = useState(currentPosition || "center center");
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const effectiveCover = selectedFile ?? currentCover;
  const previewSrc = effectiveCover ? photoUrl(effectiveCover) : null;

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setUploadName(file.name);
    setUploading(true);
    try {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const pathname = `posts/post${postId}-${ts}-${safeName}`;
      // Client → Blob direct, bypasses Vercel's 4.5 MB serverless body cap.
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload-token",
      });
      setSelectedFile(blob.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
      setUploadName(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="cover-picker">
      {/* Hidden inputs the parent <form> reads on submit. The actual file
          bytes never travel through the form — they go client → Blob first,
          then we submit only the resulting URL via cover_pick. */}
      <input type="hidden" name="cover_pick" value={selectedFile ?? ""} />
      <input type="hidden" name="cover_position" value={position} />

      {/* ── Live preview ──────────────────────────────────────────────── */}
      <div className="cover-picker__preview">
        <div className="cover-picker__preview-frame">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt="Aperçu de couverture"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position }}
            />
          ) : (
            <div className="cover-picker__empty">
              <span>Aucune couverture</span>
              <small>Choisissez une photo ou téléversez-en une.</small>
            </div>
          )}
        </div>
        <p className="cover-picker__hint">
          Aperçu au format 4:3 — c&apos;est exactement ce que les visiteurs verront sur le blog.
        </p>
      </div>

      {/* ── Source: pick from a gallery, or upload ──────────────────── */}
      <div className="cover-picker__actions">
        <button
          type="button"
          className="cover-picker__btn"
          onClick={() => setPickerOpen(true)}
        >
          📷 Choisir depuis une galerie
        </button>
        <label className={`cover-picker__btn cover-picker__btn--ghost${uploading ? " is-disabled" : ""}`}>
          {uploading ? "⏳ Téléversement en cours…" : "⬆ Téléverser une nouvelle image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={uploading}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) handleFileUpload(f);
            }}
          />
        </label>
      </div>
      {uploadName && !uploadError && (
        <p className="cover-picker__upload-note">
          {uploading
            ? <>⏳ Téléversement de <b>{uploadName}</b>…</>
            : <>✓ <b>{uploadName}</b> téléversée — cliquez sur ENREGISTRER pour l&apos;appliquer comme couverture.</>}
        </p>
      )}
      {uploadError && (
        <p className="cover-picker__upload-note" style={{ background: "rgba(139,46,46,.07)", borderColor: "#C09595", color: "#8B2E2E" }}>
          ❌ Erreur pendant le téléversement : <b>{uploadError}</b>
        </p>
      )}

      {/* ── Focal point ──────────────────────────────────────────────── */}
      <div className="cover-picker__focal">
        <div className="cover-picker__focal-label">
          <span className="admin-label">Cadrage</span>
          <span className="cover-picker__focal-current">{position}</span>
        </div>
        <div className="cover-picker__focal-grid">
          {POSITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`cover-picker__focal-cell${position === opt.value ? " is-active" : ""}`}
              onClick={() => setPosition(opt.value)}
              title={opt.label}
              aria-label={`Cadrage : ${opt.label}`}
            >
              <span className="cover-picker__focal-dot" />
            </button>
          ))}
        </div>
        <p className="cover-picker__hint">
          Cliquez sur la zone de la photo à garder visible (utile pour décentrer un sujet).
        </p>
      </div>

      {/* ── Modal: pick from gallery ─────────────────────────────────── */}
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
                  Cliquez sur une photo pour la sélectionner.
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
                  Aucune galerie publiée. Créez d&apos;abord une galerie avec des photos.
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
                        const isSelected = selectedFile === p.filename;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`cover-picker__tile${isSelected ? " is-selected" : ""}`}
                            onClick={() => {
                              setSelectedFile(p.filename);
                              setUploadName(null); // clear any pending upload
                              setPickerOpen(false);
                            }}
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
