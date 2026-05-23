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

  return (
    <div className="admin-photo-tile" style={{ opacity: pending ? 0.55 : 1, transition: "opacity .2s" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/uploads/${filename}`} alt={alt || `Photo ${id}`} />

      <div className="actions">
        {isCover ? (
          <span style={{ background: "var(--gold)", color: "#fff", borderRadius: 4, fontSize: 10, letterSpacing: ".14em", padding: "6px 10px" }}>
            COUVERTURE
          </span>
        ) : (
          <button type="button" disabled={pending} onClick={() => start(() => onSetCover())}>
            Couverture
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          style={{ background: "rgba(140, 30, 30, 0.7)" }}
          onClick={async () => {
            const ok = await confirmDialog({
              title: "Supprimer la photo",
              message: "Cette photo sera retirée de la galerie et le fichier supprimé du serveur. Cette action est irréversible.",
              tone: "danger",
              confirmLabel: "Supprimer",
            });
            if (ok) start(() => onDelete());
          }}
        >
          Suppr
        </button>
      </div>

      {/* Move arrows */}
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <button
          type="button"
          aria-label="Monter"
          disabled={pending || isFirst}
          onClick={() => start(() => onMoveUp())}
          className="tile-arrow"
          style={{ opacity: isFirst ? 0.3 : 1 }}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Descendre"
          disabled={pending || isLast}
          onClick={() => start(() => onMoveDown())}
          className="tile-arrow"
          style={{ opacity: isLast ? 0.3 : 1 }}
        >
          ↓
        </button>
      </div>

      {/* Bottom controls: span + alt */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 6, padding: 8, background: "linear-gradient(0deg, rgba(0,0,0,.45), transparent)" }}>
        <select
          value={span}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value;
            start(() => onSpanChange(v));
          }}
          style={{ fontSize: 11, padding: "4px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.92)", color: "var(--ink)" }}
        >
          <option value="">Standard</option>
          <option value="wide">Large</option>
          <option value="tall">Haute</option>
          <option value="big">Grande</option>
        </select>
        <input
          type="text"
          placeholder="Alt (description)"
          value={altText}
          onChange={(e) => { setAltText(e.target.value); setAltDirty(true); }}
          onBlur={() => {
            if (altDirty) {
              setAltDirty(false);
              start(() => onAltChange(altText));
            }
          }}
          disabled={pending}
          style={{ flex: 1, minWidth: 0, fontSize: 11, padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.92)", color: "var(--ink)" }}
        />
      </div>
    </div>
  );
}
