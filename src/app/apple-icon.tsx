import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#2E3D2E",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            border: "2px solid #D4B97A",
            padding: "16px 26px",
            color: "#D4B97A",
            fontSize: 70,
            letterSpacing: "0.06em",
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          RP
        </div>
        <div style={{ color: "#D4B97A", fontSize: 16, letterSpacing: "0.32em", marginTop: 12 }}>
          ROMERO
        </div>
      </div>
    ),
    { ...size }
  );
}
