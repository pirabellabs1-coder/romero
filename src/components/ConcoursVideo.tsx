"use client";
/**
 * Lazy hero video for the concours page.
 *
 * Ships zero video bytes until the user hits play — the browser only
 * downloads the tiny poster image (~40 KB). This keeps the LCP well
 * under 1 s even on 3G, without giving up the visual anchor of the
 * hero split layout.
 *
 * The overlay play button is a real <button> so keyboard users can
 * trigger playback, and its state ("primed" vs "playing") drives the
 * fade-out CSS transition.
 */
import { useRef, useState } from "react";
import Image from "next/image";

type Props = {
  src: string;
  posterSrc: string;
  posterAlt: string;
  posterWidth: number;
  posterHeight: number;
};

export default function ConcoursVideo({ src, posterSrc, posterAlt, posterWidth, posterHeight }: Props) {
  const [primed, setPrimed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function handlePlay() {
    setPrimed(true);
    // Le browser peut mettre un frame ou deux à monter la vidéo dans
    // le DOM ; on relance play() côté client après un tick pour couvrir
    // le cas où l'attribut autoPlay ne suffit pas (Safari mobile).
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        /* autoplay policy — l'utilisateur peut cliquer sur les contrôles natifs */
      });
    });
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      {!primed && (
        <>
          <Image
            src={posterSrc}
            alt={posterAlt}
            width={posterWidth}
            height={posterHeight}
            priority
            sizes="(max-width: 600px) 100vw, 420px"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <button
            type="button"
            onClick={handlePlay}
            aria-label="Lancer la vidéo"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)",
              border: 0,
              cursor: "pointer",
              padding: 0,
              transition: "background 200ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.42) 100%)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)")}
          >
            <span
              style={{
                width: 82,
                height: 82,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.94)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 12px 30px rgba(0, 0, 0, 0.35)",
                transition: "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
              }}
              className="concours-play-icon"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--forest)" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        </>
      )}
      {primed && (
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          playsInline
          preload="auto"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
        />
      )}
      <style>{`
        .concours-play-icon:hover { transform: scale(1.08); }
        .concours-play-icon:active { transform: scale(0.94); }
      `}</style>
    </div>
  );
}
