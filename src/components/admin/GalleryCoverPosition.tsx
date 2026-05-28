"use client";
import { useEffect, useState } from "react";
import { photoUrl } from "@/lib/photo-url";
import FocalPointPicker from "@/components/admin/FocalPointPicker";

type Props = {
  galleryId: number;
  /** Filename of the current cover photo (URL or relative). */
  coverFilename: string | null;
  /** Current cover_position from the DB. */
  currentPosition: string;
  /** Live-save action; returns ok/error for inline feedback. */
  saveAction: (
    galleryId: number,
    position: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * Click-to-set focal point for a gallery's hero cover.
 *
 * The gallery edit page lets the photographer pick which photo is the
 * cover via the "Couverture" buttons on each PhotoTile (already exists).
 * This widget complements that by letting her position the cropping of
 * that cover — same UX as the blog cover picker. Used on both /portfolio
 * (the thumbnail grid) and /portfolio/[slug] (the hero banner) so what
 * she sees here previews both views accurately.
 */
export default function GalleryCoverPosition({
  galleryId,
  coverFilename,
  currentPosition,
  saveAction,
}: Props) {
  const [position, setPosition] = useState(currentPosition || "center center");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (status.kind !== "saved") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 1800);
    return () => clearTimeout(t);
  }, [status]);

  const src = coverFilename ? photoUrl(coverFilename) : null;

  async function handleChange(next: string) {
    setPosition(next);
    setStatus({ kind: "saving" });
    const res = await saveAction(galleryId, next);
    setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: res.error });
  }

  const banner = (() => {
    switch (status.kind) {
      case "idle":   return null;
      case "saving": return { color: "var(--muted)",     text: "Enregistrement…" };
      case "saved":  return { color: "var(--sage-deep)", text: "✓ Enregistré" };
      case "error":  return { color: "#8B2E2E",          text: `❌ ${status.message}` };
    }
  })();

  if (!src) {
    return (
      <p className="muted" style={{ fontSize: 13, fontStyle: "italic" }}>
        Choisissez d&apos;abord une couverture (bouton « Définir comme couverture » sur une photo) pour pouvoir régler son cadrage.
      </p>
    );
  }

  return (
    <div className="cover-picker">
      <div className="cover-picker__preview-head">
        <span className="cover-picker__hint">
          Cliquez sur la photo pour choisir la zone à garder visible. C&apos;est ce cadrage qui sera utilisé sur le portfolio et l&apos;en-tête de la galerie.
        </span>
        {banner && (
          <span className="cover-picker__status" style={{ color: banner.color }}>
            {banner.text}
          </span>
        )}
      </div>
      <FocalPointPicker
        src={src}
        value={position}
        ratio="4 / 5"
        onChange={handleChange}
      />
    </div>
  );
}
