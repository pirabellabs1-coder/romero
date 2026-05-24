export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--cream)" }}>
      <div style={{ textAlign: "center" }}>
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "2px solid var(--rule)",
            borderTopColor: "var(--gold)",
            animation: "rp-spin 0.9s linear infinite",
          }}
        />
        <div style={{ marginTop: 16, fontSize: 12, letterSpacing: ".28em", color: "var(--muted)", textTransform: "uppercase" }}>
          Chargement
        </div>
      </div>
      <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
