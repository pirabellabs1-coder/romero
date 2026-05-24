"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F8F4EC", color: "#2E3D2E" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 40 }}>
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <div style={{ display: "inline-block", border: "1px solid #D4B97A", padding: "12px 18px", marginBottom: 22 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 26, color: "#2E3D2E", letterSpacing: ".08em" }}>RP</div>
            </div>
            <div style={{ fontSize: 11, letterSpacing: ".32em", color: "#B8975A", textTransform: "uppercase", marginBottom: 14 }}>Erreur</div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 400, margin: 0, color: "#2E3D2E" }}>
              Une erreur est survenue
            </h1>
            <p style={{ color: "#7A7066", marginTop: 14, lineHeight: 1.6 }}>
              Désolé, quelque chose s&apos;est mal passé. Nous avons été notifiés.
            </p>
            <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={reset}
                style={{
                  background: "#2E3D2E", color: "#F4EFE3", border: 0, borderRadius: 4,
                  padding: "12px 26px", fontSize: 11, letterSpacing: ".22em", textTransform: "uppercase",
                  cursor: "pointer", fontWeight: 500,
                }}
              >
                Réessayer
              </button>
              <a
                href="/"
                style={{
                  background: "transparent", color: "#2E3D2E", border: "1px solid rgba(184,151,90,.4)",
                  borderRadius: 4, padding: "11px 26px", fontSize: 11, letterSpacing: ".22em",
                  textTransform: "uppercase", textDecoration: "none", fontWeight: 500,
                }}
              >
                Retour à l&apos;accueil
              </a>
            </div>
            {error.digest && (
              <p style={{ fontSize: 11, color: "#9B948A", marginTop: 30, letterSpacing: ".12em" }}>
                Référence&nbsp;: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
