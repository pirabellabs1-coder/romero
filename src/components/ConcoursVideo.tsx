"use client";
/**
 * Hero video for /concours — click to play, avec son.
 *
 * Les navigateurs bloquent tout autoplay accompagné de son (Chrome,
 * Safari, Firefox) : seule l'action utilisateur autorise la piste
 * audio à jouer. Plutôt que de forcer un autoplay silencieux, on
 * affiche un poster léger (WebP 40 KB, LCP-friendly) surmonté d'un
 * gros bouton play. Au clic, la vidéo remplace le poster et démarre
 * avec le son.
 *
 * Zéro octet de vidéo n'est téléchargé tant que le play n'a pas été
 * cliqué — la page reste ultra-rapide au premier rendu.
 */
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Props = {
  src: string;
  posterSrc: string;
  posterAlt: string;
  posterWidth: number;
  posterHeight: number;
};

export default function ConcoursVideo({ src, posterSrc, posterAlt, posterWidth, posterHeight }: Props) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function startPlayback() {
    setPlaying(true);
  }

  // Une fois la vidéo montée dans le DOM (après clic), on lance play().
  // Comme le clic sert de gesture utilisateur, le browser autorise le son.
  useEffect(() => {
    if (!playing) return;
    videoRef.current?.play().catch(() => {
      /* si le browser refuse quand même, l'utilisateur a les contrôles */
    });
  }, [playing]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden" }}>
      {!playing && (
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
            onClick={startPlayback}
            aria-label="Lancer la vidéo"
            className="concours-play-btn"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.38) 100%)",
              border: 0,
              cursor: "pointer",
              padding: 0,
              transition: "background 200ms ease",
            }}
          >
            <span
              className="concours-play-icon"
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.96)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 14px 36px rgba(0, 0, 0, 0.42)",
                transition: "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
              }}
            >
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="var(--forest)"
                aria-hidden
                style={{ marginLeft: 4 }}
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        </>
      )}
      {playing && (
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="auto"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
        />
      )}
      <style>{`
        .concours-play-btn:hover {
          background: linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.44) 100%) !important;
        }
        .concours-play-btn:hover .concours-play-icon {
          transform: scale(1.08);
        }
        .concours-play-btn:active .concours-play-icon {
          transform: scale(0.94);
        }
      `}</style>
    </div>
  );
}
