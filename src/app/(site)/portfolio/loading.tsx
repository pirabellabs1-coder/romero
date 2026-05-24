export default function Loading() {
  return (
    <main style={{ minHeight: "70vh", paddingTop: 200, background: "var(--cream)" }}>
      <div className="container" style={{ textAlign: "center" }}>
        <div className="cap-tracked gold" style={{ marginBottom: 22 }}>PORTFOLIO MARIAGE</div>
        <div
          aria-hidden
          style={{
            margin: "30px auto",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "2px solid var(--rule)",
            borderTopColor: "var(--gold)",
            animation: "rp-spin 0.9s linear infinite",
          }}
        />
        <p className="muted" style={{ fontSize: 14, fontStyle: "italic" }}>Chargement du portfolio…</p>
      </div>
      <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
