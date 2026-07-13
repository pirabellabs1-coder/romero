"use client";
/**
 * Hero video for /concours with LCP-friendly autoplay.
 *
 * Séquence de chargement :
 *   1. Le poster WebP (~40 KB) s'affiche instantanément — c'est lui
 *      le LCP.
 *   2. Après le premier idle du navigateur (page interactive et pas
 *      de layout thrash), on monte le <video> avec autoplay/muted/loop.
 *      Le navigateur commence à streamer ; le poster reste visible
 *      pendant la première frame puis fait un fondu vers la vidéo.
 *   3. Un bouton discret « son / muet » permet à l'utilisateur
 *      d'activer l'audio en un clic.
 *
 * Sans ce délai, le browser download la vidéo en priorité et la LCP
 * s'écroule. Avec, on garde le meilleur des deux : ambience vidéo
 * automatique + LCP < 1 s.
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
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoVisible, setVideoVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Déclenche le montage de la vidéo au premier idle après hydratation,
  // pour laisser passer le LCP (le poster) avant d'occuper la bande passante.
  useEffect(() => {
    const trigger = () => setReady(true);
    // Fallback si requestIdleCallback n'existe pas (Safari).
    const rIC = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const id = typeof rIC === "function"
      ? rIC(trigger, { timeout: 1500 })
      : window.setTimeout(trigger, 800);
    return () => {
      const cIC = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (typeof cIC === "function") cIC(id);
      else clearTimeout(id);
    };
  }, []);

  // Une fois la vidéo prête à jouer (metadata + première frame décodées),
  // on fond le poster pour éviter tout flash de contenu blanc/noir.
  function handleCanPlay() {
    setVideoVisible(true);
    videoRef.current?.play().catch(() => {
      /* autoplay bloqué — l'utilisateur verra les contrôles */
    });
  }

  function toggleSound() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden" }}>
      {/* Poster : LCP-friendly, reste visible pendant que la vidéo se prépare */}
      <Image
        src={posterSrc}
        alt={posterAlt}
        width={posterWidth}
        height={posterHeight}
        priority
        sizes="(max-width: 600px) 100vw, 420px"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          position: "absolute",
          inset: 0,
          opacity: videoVisible ? 0 : 1,
          transition: "opacity 350ms ease",
          zIndex: 1,
        }}
      />

      {/* Vidéo montée après l'idle initial */}
      {ready && (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={handleCanPlay}
          aria-label="Vidéo présentant le grand concours"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            position: "relative",
            zIndex: 2,
            opacity: videoVisible ? 1 : 0,
            transition: "opacity 350ms ease",
          }}
        />
      )}

      {/* Bouton son — discret, en bas à droite */}
      {ready && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          title={muted ? "Activer le son" : "Couper le son"}
          className="concours-video-mute"
          style={{
            position: "absolute",
            right: 14,
            bottom: 14,
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "rgba(46, 61, 46, 0.72)",
            color: "#F4EFE3",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 3,
            backdropFilter: "blur(4px)",
            transition: "background 180ms, transform 180ms",
          }}
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
      )}

      <style>{`
        .concours-video-mute:hover {
          background: rgba(46, 61, 46, 0.9) !important;
          transform: scale(1.06);
        }
        .concours-video-mute:active {
          transform: scale(0.94);
        }
      `}</style>
    </div>
  );
}
