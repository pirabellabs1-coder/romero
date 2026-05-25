"use client";
import { useEffect, useRef, useState } from "react";
import Rise from "@/components/Rise";
import Stars from "@/components/Stars";
import GoogleG from "@/components/GoogleG";
import type { ReviewRow } from "@/lib/content";
import type { Lang } from "@/lib/i18n";

type Props = {
  reviews: ReviewRow[];
  lang: Lang;
};

const AUTOPLAY_INTERVAL_MS = 6000;

export default function ReviewsCarousel({ reviews, lang }: Props) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || reviews.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setActive((a) => (a + 1) % reviews.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, reviews.length]);

  // Pause when the carousel is off-screen to save cycles
  useEffect(() => {
    const root = document.getElementById("reviews-carousel-root");
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setPaused((p) => (e.isIntersecting ? false : true))),
      { threshold: 0.2 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  if (reviews.length === 0) return null;

  const text = (r: ReviewRow) => (lang === "en" && r.text_en ? r.text_en : r.text_fr);

  return (
    <div
      id="reviews-carousel-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="responsive-3col" style={{ position: "relative", alignItems: "stretch" }}>
        {[0, 1, 2].map((idx) => {
          const r = reviews[(active + idx) % reviews.length];
          return (
            <Rise key={`${idx}-${active}`}>
              <div style={{ background: "#fff", border: "1px solid var(--rule)", padding: 32, height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--sage-soft)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--forest)",
                      fontFamily: "var(--serif)",
                      fontSize: 20,
                    }}
                  >
                    {r.name[0]}
                  </div>
                  <div>
                    <div className="serif" style={{ fontSize: 17, color: "var(--forest)" }}>
                      {r.name}
                    </div>
                    {r.date_label && (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.date_label}</div>
                    )}
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 14 }}>
                    <GoogleG />
                  </div>
                </div>
                <Stars rating={r.rating} />
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink)", marginTop: 16, flex: 1 }}>« {text(r)} »</p>
              </div>
            </Rise>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, marginTop: 40 }}>
        <button
          aria-label="Avis précédent"
          onClick={() => setActive((active - 1 + reviews.length) % reviews.length)}
          style={{
            background: "transparent",
            border: "1px solid var(--rule)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            color: "var(--forest)",
            fontSize: 16,
          }}
        >
          ←
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {reviews.map((_, i) => (
            <button
              key={i}
              aria-label={`Avis ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              style={{
                width: i === active ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: i === active ? "var(--gold)" : "var(--rule)",
                border: 0,
                padding: 0,
                cursor: "pointer",
                transition: "width .3s ease, background .3s ease",
              }}
            />
          ))}
        </div>
        <button
          aria-label="Avis suivant"
          onClick={() => setActive((active + 1) % reviews.length)}
          style={{
            background: "transparent",
            border: "1px solid var(--rule)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            color: "var(--forest)",
            fontSize: 16,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
