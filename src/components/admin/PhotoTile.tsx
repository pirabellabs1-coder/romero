"use client";
import { useState, useTransition } from "react";
import { confirmDialog } from "@/components/ui/Modal";

type Props = {
  id: number;
  filename: string;
  alt: string;
  span: string;
  isCover: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSetCover: () => Promise<void>;
  onDelete: () => Promise<void>;
  onSpanChange: (span: string) => Promise<void>;
  onAltChange: (alt: string) => Promise<void>;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
};

const SPAN_LABEL: Record<string, string> = {
  "": "Standard",
  wide: "Large",
  tall: "Haute",
  big: "Grande",
};

export default function PhotoTile({
  id,
  filename,
  alt,
  span,
  isCover,
  isFirst,
  isLast,
  onSetCover,
  onDelete,
  onSpanChange,
  onAltChange,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [pending, start] = useTransition();
  const [altText, setAltText] = useState(alt);
  const [altDirty, setAltDirty] = useState(false);

  const src = filename.startsWith("http") ? filename : `/uploads/${filename}`;

  return (
    <article className={`photo-card${isCover ? " is-cover" : ""}${pending ? " is-pending" : ""}`}>
      <div className="photo-card__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt || `Photo ${id}`} />

        {isCover && (
          <span className="photo-card__cover-ribbon" aria-label="Photo de couverture">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 1.5l1.95 4.36 4.8.45-3.62 3.18 1.07 4.7L8 11.85l-4.2 2.34 1.08-4.7L1.25 6.3l4.8-.45L8 1.5z" />
            </svg>
            <span>Couverture</span>
          </span>
        )}

        <div className="photo-card__hover">
          <div className="photo-card__hover-group">
            <button
              type="button"
              className="photo-card__icon"
              aria-label="Monter dans l'ordre"
              title="Monter"
              disabled={pending || isFirst}
              onClick={() => start(() => onMoveUp())}
            >
              ↑
            </button>
            <button
              type="button"
              className="photo-card__icon"
              aria-label="Descendre dans l'ordre"
              title="Descendre"
              disabled={pending || isLast}
              onClick={() => start(() => onMoveDown())}
            >
              ↓
            </button>
          </div>

          <button
            type="button"
            className="photo-card__icon photo-card__icon--danger"
            aria-label="Supprimer la photo"
            title="Supprimer"
            disabled={pending}
            onClick={async () => {
              const ok = await confirmDialog({
                title: "Supprimer la photo",
                message:
                  "Cette photo sera retirée de la galerie et le fichier supprimé du serveur. Cette action est irréversible.",
                tone: "danger",
                confirmLabel: "Supprimer",
              });
              if (ok) start(() => onDelete());
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <div className="photo-card__body">
        <div className="photo-card__row">
          <button
            type="button"
            className={`photo-card__cover-btn${isCover ? " is-active" : ""}`}
            disabled={pending || isCover}
            onClick={() => start(() => onSetCover())}
            title={isCover ? "Couverture actuelle" : "Définir comme couverture"}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 1.5l1.95 4.36 4.8.45-3.62 3.18 1.07 4.7L8 11.85l-4.2 2.34 1.08-4.7L1.25 6.3l4.8-.45L8 1.5z" />
            </svg>
            <span>{isCover ? "Couverture" : "Définir comme couverture"}</span>
          </button>
        </div>

        <div className="photo-card__row">
          <label className="photo-card__label" htmlFor={`span-${id}`}>
            Format
          </label>
          <select
            id={`span-${id}`}
            className="photo-card__select"
            value={span}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              start(() => onSpanChange(v));
            }}
            title={`Format actuel : ${SPAN_LABEL[span] || "Standard"}`}
          >
            <option value="">Standard</option>
            <option value="wide">Large</option>
            <option value="tall">Haute</option>
            <option value="big">Grande</option>
          </select>
        </div>

        <div className="photo-card__row">
          <label className="photo-card__label" htmlFor={`alt-${id}`}>
            Description
          </label>
          <input
            id={`alt-${id}`}
            type="text"
            className="photo-card__input"
            placeholder="Texte alternatif (SEO)"
            value={altText}
            onChange={(e) => {
              setAltText(e.target.value);
              setAltDirty(true);
            }}
            onBlur={() => {
              if (altDirty) {
                setAltDirty(false);
                start(() => onAltChange(altText));
              }
            }}
            disabled={pending}
          />
        </div>
      </div>
    </article>
  );
}
