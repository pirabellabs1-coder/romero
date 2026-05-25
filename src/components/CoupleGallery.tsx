"use client";
import { useRef } from "react";
import Link from "next/link";
import OrnamentDivider from "@/components/OrnamentDivider";
import type { Strings } from "@/lib/i18n";
import type { GalleryRow, PhotoRow } from "@/lib/content";

type Props = {
  t: Strings;
  gallery: GalleryRow;
  photos: PhotoRow[];
  intro: string;
};

const SPAN_RATIOS: Record<string, string> = {
  wide: "3 / 2",
  tall: "3 / 4",
  big: "1 / 1",
  "": "4 / 5",
};

export default function CoupleGallery({ t, gallery, photos, intro }: Props) {
  const refs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Click a thumbnail → scroll to it & enlarge it inline (instead of zoom modal)
  const onPhotoClick = (id: number, el: HTMLDivElement | null) => {
    if (!el) return;
    // 1. Toggle "focused" state — large display
    refs.current.forEach((other) => {
      if (other !== el) other.classList.remove("masonry-focused");
    });
    el.classList.toggle("masonry-focused");
    // 2. Smooth-scroll to the photo, centered in viewport
    if (el.classList.contains("masonry-focused")) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <main className="page-enter">
      {/* HERO */}
      <section style={{ position: "relative", height: "85vh", minHeight: 600, overflow: "hidden", background: "var(--cream-deep)" }}>
        {gallery.cover_filename ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/uploads/${gallery.cover_filename}`}
            alt={gallery.names}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
        ) : (
          <div className="placeholder" style={{ position: "absolute", inset: 0, borderRadius: 0, border: 0 }}>
            <span>{gallery.names}</span>
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(31,42,31,.55), transparent 50%)" }} />
        <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, textAlign: "center", color: "#F4EFE3" }}>
          <div className="cap-tracked" style={{ color: "var(--gold-light)", marginBottom: 22 }}>
            {t.portfolio.caseEyebrow} — {gallery.region}
          </div>
          <h1
            className="serif"
            style={{ fontSize: "clamp(48px, 6vw, 86px)", margin: 0, fontStyle: "italic", fontWeight: 400, color: "#F4EFE3" }}
          >
            {gallery.names}
          </h1>
          <div style={{ marginTop: 18, fontSize: 13, letterSpacing: "0.32em", color: "#E5E1D8", textTransform: "uppercase" }}>
            {gallery.place} · {gallery.date_label}
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section style={{ background: "var(--cream)", padding: "90px 0" }}>
        <div className="container" style={{ maxWidth: 760, textAlign: "center" }}>
          <div className="cap-tracked gold">{t.portfolio.caseStory}</div>
          <OrnamentDivider />
          <p className="serif" style={{ fontSize: 22, color: "var(--forest)", lineHeight: 1.6, fontStyle: "italic" }}>
            {intro}
          </p>
        </div>
      </section>

      {/* MASONRY GALLERY */}
      <section style={{ background: "var(--cream)", paddingBottom: 120 }}>
        <div className="container-wide couple-masonry">
          {photos.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
              Galerie en préparation.
            </div>
          )}
          {photos.map((p, i) => {
            const ratio = SPAN_RATIOS[p.span] ?? "4 / 5";
            const cls = "masonry-cell" + (p.span ? ` span-${p.span}` : "");
            const eager = i < 4;
            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) refs.current.set(p.id, el);
                  else refs.current.delete(p.id);
                }}
                className={cls}
                onClick={(e) => onPhotoClick(p.id, e.currentTarget)}
                style={{ aspectRatio: p.span === "tall" || p.span === "big" ? undefined : ratio }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/uploads/${p.filename}`}
                  alt={p.alt || p.filename}
                  loading={eager ? "eager" : "lazy"}
                  fetchPriority={eager ? "high" : "low"}
                  decoding="async"
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* BACK + CTA */}
      <section style={{ background: "var(--cream-deep)", padding: "60px 0", borderTop: "1px solid var(--rule)" }}>
        <div
          className="container"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}
        >
          <Link href="/portfolio" className="btn btn-ghost">
            {t.portfolio.backToPortfolio}
          </Link>
          <Link href="/contact" className="btn btn-sage">
            {t.book}
          </Link>
        </div>
      </section>
    </main>
  );
}
