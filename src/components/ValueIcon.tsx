export type ValueKind = "authenticity" | "elegance" | "closeness" | "excellence" | "detail" | "emotion";

export default function ValueIcon({ kind, size = 38 }: { kind: ValueKind; size?: number }) {
  const stroke = "#B8975A";
  const sw = 1;
  if (kind === "authenticity") {
    return (
      <svg className="no-tweak" width={size} height={size} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="13" stroke={stroke} strokeWidth={sw} fill="none" />
        <circle cx="20" cy="20" r="2" fill={stroke} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line
            key={a}
            x1="20"
            y1="20"
            x2={20 + Math.cos((a * Math.PI) / 180) * 12}
            y2={20 + Math.sin((a * Math.PI) / 180) * 12}
            stroke={stroke}
            strokeWidth={sw * 0.7}
            opacity="0.55"
          />
        ))}
      </svg>
    );
  }
  if (kind === "elegance") {
    return (
      <svg className="no-tweak" width={size} height={size} viewBox="0 0 40 40">
        <rect x="11" y="11" width="18" height="18" transform="rotate(45 20 20)" stroke={stroke} strokeWidth={sw} fill="none" />
        <rect x="15" y="15" width="10" height="10" transform="rotate(45 20 20)" stroke={stroke} strokeWidth={sw * 0.7} fill="none" opacity="0.55" />
      </svg>
    );
  }
  if (kind === "closeness") {
    return (
      <svg className="no-tweak" width={size} height={size} viewBox="0 0 40 40">
        <circle cx="15" cy="20" r="9" stroke={stroke} strokeWidth={sw} fill="none" />
        <circle cx="25" cy="20" r="9" stroke={stroke} strokeWidth={sw} fill="none" />
      </svg>
    );
  }
  if (kind === "excellence") {
    return (
      <svg className="no-tweak" width={size} height={size} viewBox="0 0 40 40">
        <line x1="20" y1="6" x2="20" y2="34" stroke={stroke} strokeWidth={sw} />
        <line x1="6" y1="20" x2="34" y2="20" stroke={stroke} strokeWidth={sw} />
        <line x1="10" y1="10" x2="30" y2="30" stroke={stroke} strokeWidth={sw * 0.6} opacity=".6" />
        <line x1="30" y1="10" x2="10" y2="30" stroke={stroke} strokeWidth={sw * 0.6} opacity=".6" />
        <rect x="16" y="16" width="8" height="8" transform="rotate(45 20 20)" fill="none" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (kind === "detail") {
    return (
      <svg className="no-tweak" width={size} height={size} viewBox="0 0 40 40">
        <rect x="8" y="8" width="24" height="24" stroke={stroke} strokeWidth={sw} fill="none" />
        <rect x="14" y="14" width="12" height="12" stroke={stroke} strokeWidth={sw * 0.7} fill="none" opacity=".7" />
        <rect x="18" y="18" width="4" height="4" fill={stroke} />
      </svg>
    );
  }
  return (
    <svg className="no-tweak" width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="12" stroke={stroke} strokeWidth={sw} fill="none" />
      <circle cx="20" cy="20" r="6" stroke={stroke} strokeWidth={sw * 0.7} fill="none" opacity=".7" />
      <circle cx="20" cy="20" r="2" fill={stroke} />
    </svg>
  );
}
