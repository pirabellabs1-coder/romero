export default function StepNumber({ n }: { n: number }) {
  return (
    <div style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg className="no-tweak" width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute" }}>
        <circle cx="28" cy="28" r="26" fill="none" stroke="#B8975A" strokeWidth="0.6" />
        <circle cx="28" cy="28" r="22" fill="none" stroke="#B8975A" strokeWidth="0.4" opacity="0.5" />
      </svg>
      <span className="serif" style={{ fontSize: 22, color: "var(--gold)", fontStyle: "italic" }}>
        {String(n).padStart(2, "0")}
      </span>
    </div>
  );
}
