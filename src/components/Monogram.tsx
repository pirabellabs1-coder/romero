import React from "react";

type Props = {
  size?: number;
  label?: boolean;
  sublabel?: boolean;
};

export default function Monogram({ size = 60, label = true, sublabel = true }: Props) {
  const w = size;
  const h = size * 1.05;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
      <svg width={w} height={h} viewBox="0 0 100 105" fill="none" xmlns="http://www.w3.org/2000/svg" className="no-tweak">
        <rect x="6" y="6" width="88" height="93" stroke="#B8975A" strokeWidth="0.6" fill="none" />
        <rect x="9" y="9" width="82" height="87" stroke="#B8975A" strokeWidth="0.4" fill="none" opacity="0.6" />
        <g fill="#B8975A">
          <rect x="48" y="2.5" width="4" height="4" transform="rotate(45 50 4.5)" />
          <line x1="20" y1="6" x2="40" y2="6" stroke="#B8975A" strokeWidth="0.4" />
          <line x1="60" y1="6" x2="80" y2="6" stroke="#B8975A" strokeWidth="0.4" />
          <rect x="48" y="98.5" width="4" height="4" transform="rotate(45 50 100.5)" />
          <line x1="20" y1="99" x2="40" y2="99" stroke="#B8975A" strokeWidth="0.4" />
          <line x1="60" y1="99" x2="80" y2="99" stroke="#B8975A" strokeWidth="0.4" />
        </g>
        <g stroke="#B8975A" strokeWidth="0.4" fill="none">
          <path d="M14 14 Q14 10 18 10" />
          <path d="M86 14 Q86 10 82 10" />
          <path d="M14 91 Q14 95 18 95" />
          <path d="M86 91 Q86 95 82 95" />
        </g>
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontFamily="Cormorant Garamond, Georgia, serif"
          fontSize="40"
          fontWeight={500}
          fill="#2E3D2E"
          letterSpacing="2"
          textRendering="geometricPrecision"
        >
          RP
        </text>
      </svg>
      {label && (
        <div style={{ textAlign: "center", marginTop: 2 }}>
          <div className="serif" style={{ fontSize: 17, letterSpacing: "0.32em", color: "var(--forest)", fontWeight: 500 }}>
            ROMERO
          </div>
          {sublabel && (
            <div style={{ fontSize: 8, letterSpacing: "0.32em", color: "var(--gold)", marginTop: 4, fontFamily: "var(--sans)" }}>
              PHOTOGRAPHY
            </div>
          )}
        </div>
      )}
    </div>
  );
}
