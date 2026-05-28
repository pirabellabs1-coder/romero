"use client";
import { useState } from "react";
import { photoUrl } from "@/lib/photo-url";

type GalleryPhoto = { id: number; gallery_id: number; filename: string };
type GalleryWithPhotos = {
  id: number;
  names: string;
  place: string;
  photos: GalleryPhoto[];
};

type Props = {
  /** Current cover filename (URL or relative path). May be null if none set yet. */
  currentCover: string | null;
  /** Current object-position CSS value (e.g. "center top"). */
  currentPosition: string;
  /** All published galleries with their photos — fetched server-side. */
  galleries: GalleryWithPhotos[];
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

export default function CoverPicker({ currentCover, currentPosition, galleries }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [position, setPosition] = useState(currentPosition || "center center");
  const [uploadName, setUploadName] = useState<string | null>(null);

  // The displayed cover is either: a freshly-picked filename, or the existing
  // one. (We never preview a freshly-uploaded file URL — that requires
  // FileReader and adds complexity for negligible UX gain.)
  const effectiveCover = selectedFile ?? currentCover;
  const previewSrc = effectiveCover ? photoUrl(effectiveCover) : null;

  return (
    <div className="cover-picker">
      {/* Hidden inputs that the parent <form> reads on submit. */}
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
        <label className="cover-picker__btn cover-picker__btn--ghost">
          ⬆ Téléverser une nouvelle image
          <input
            type="file"
            name="cover"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              setUploadName(f ? f.name : null);
              // Clear any gallery selection — upload takes precedence.
              if (f) setSelectedFile(null);
            }}
          />
        </label>
      </div>
      {uploadName && (
        <p className="cover-picker__upload-note">
          ✓ Nouvelle image sélectionnée : <b>{uploadName}</b> — elle remplacera la couverture à l&apos;enregistrement.
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
