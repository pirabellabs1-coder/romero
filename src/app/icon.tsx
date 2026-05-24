import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#2E3D2E",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontSize: 18,
          color: "#D4B97A",
          letterSpacing: "0.05em",
          fontWeight: 500,
        }}
      >
        RP
      </div>
    ),
    { ...size }
  );
}
