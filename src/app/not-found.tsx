import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 40, background: "var(--cream)" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div className="cap-tracked gold">404</div>
        <h1 className="h-display" style={{ marginTop: 14, fontSize: 56 }}>
          Page <span className="italic-gold" style={{ fontStyle: "italic" }}>introuvable</span>
        </h1>
        <p className="muted" style={{ marginTop: 18 }}>
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <Link href="/" className="btn btn-sage" style={{ marginTop: 28 }}>
          RETOUR À L&apos;ACCUEIL
        </Link>
      </div>
    </main>
  );
}
