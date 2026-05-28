"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import Rise from "@/components/Rise";
import Photo from "@/components/Photo";
import type { GalleryRow } from "@/lib/content";

type GalleryWithCover = GalleryRow & { coverUrl: string };

type Props = {
  filters: string[];
  galleries: GalleryWithCover[];
};

export default function PortfolioGrid({ filters, galleries }: Props) {
  const [filter, setFilter] = useState(filters[0]);

  // Filter by gallery.kind (MARIAGE / ENGAGEMENT / PORTRAIT / LIFESTYLE)
  // The filter labels in i18n map 1:1 to these kind values (uppercase).
  const FILTER_TO_KIND: Record<number, string> = {
    0: "MARIAGE",
    1: "ENGAGEMENT",
    2: "PORTRAIT",
    3: "LIFESTYLE",
  };

  const filtered = useMemo(() => {
    const idx = filters.indexOf(filter);
    const kind = FILTER_TO_KIND[idx];
    if (!kind) return galleries;
    return galleries.filter((g) => g.kind === kind);
  }, [filter, filters, galleries]);

  return (
    <>
      <section style={{ background: "var(--cream)", paddingBottom: 40 }}>
        <div className="container-wide" style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="btn"
              style={{
                background: filter === f ? "var(--forest)" : "transparent",
                color: filter === f ? "#F4EFE3" : "var(--forest)",
                borderColor: filter === f ? "var(--forest)" : "var(--rule)",
                fontSize: 10,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--cream)", paddingBottom: 120 }}>
        {filtered.length === 0 ? (
          <div
            className="container"
            style={{ textAlign: "center", padding: "60px 20px 40px", maxWidth: 580, color: "var(--muted)" }}
          >
            <div className="serif" style={{ fontSize: 24, color: "var(--forest)", fontStyle: "italic", marginBottom: 14 }}>
              Bientôt en ligne
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              Cette catégorie sera enrichie prochainement. En attendant, parcourez les autres reportages ou contactez-moi pour en discuter.
            </p>
          </div>
        ) : (
          <div className="container-wide portfolio-grid">
            {filtered.map((g, i) => (
              <Rise key={g.id} delay={(i % 3) * 80}>
                <Link href={`/portfolio/${g.slug}`}>
                  <div style={{ cursor: "pointer" }}>
                    <div style={{ position: "relative", overflow: "hidden" }}>
                      <div style={{ aspectRatio: i % 4 === 0 ? "3 / 4" : "4 / 5", overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={g.coverUrl}
                          alt={g.names}
                          loading={i < 3 ? "eager" : "lazy"}
                          fetchPriority={i < 3 ? "high" : "low"}
                          decoding="async"
                          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.cover_position || "center center", transition: "transform 1.2s ease" }}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 22, textAlign: "center" }}>
                      <div className="cap-tracked-sm gold">
                        {g.region} — {g.place.toUpperCase().split(",")[0]}
                      </div>
                      <div className="serif" style={{ fontSize: 26, color: "var(--forest)", marginTop: 8, fontStyle: "italic" }}>
                        {g.names}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: "0.04em" }}>{g.date_label}</div>
                    </div>
                  </div>
                </Link>
              </Rise>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
