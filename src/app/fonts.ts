import { Cormorant_Garamond, Inter } from "next/font/google";

/**
 * Default site fonts — self-hosted by Next.js, zero external request, no FOUT.
 * The admin can still override via `getSettings()` for stylistic tweaks, but the
 * baseline below is what 99% of visitors see.
 */
export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif-default",
});

export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-sans-default",
});
