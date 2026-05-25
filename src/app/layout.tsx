import "@/styles/globals.css";
import type { Metadata } from "next";
import { getSettings, buildTokenStyle } from "@/lib/settings";
import ModalProvider from "@/components/ui/Modal";
import { localBusinessSchema, personSchema, websiteSchema, jsonLdScript } from "@/lib/jsonld";
import { cormorant, inter } from "@/app/fonts";

// Use ISR with short revalidation — settings have a 15s memory cache anyway, and admin actions call revalidatePath()
export const revalidate = 60;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Romero Photography — Photographe de mariage à Nice",
    template: "%s · Romero Photography",
  },
  description:
    "Romero Photography — photographe de mariage à Nice & sur la Côte d'Azur. Reportages élégants, lumineux, intemporels. Disponible partout en France et à l'étranger.",
  keywords: [
    "photographe mariage Nice",
    "photographe mariage Côte d'Azur",
    "wedding photographer Nice",
    "wedding photographer French Riviera",
    "Romero Photography",
    "reportage mariage",
    "photographe Èze",
    "photographe Saint-Paul-de-Vence",
    "photographe Cap Ferrat",
  ],
  authors: [{ name: "Mickael Romero" }],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName: "Romero Photography",
    title: "Romero Photography — Photographe de mariage à Nice",
    description: "Reportages de mariage élégants à Nice, sur la Côte d'Azur et à l'international.",
    images: [{ url: "/uploads/hero.jpg", width: 1200, height: 1500, alt: "Romero Photography" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Romero Photography",
    description: "Photographe de mariage à Nice & dans le monde.",
    images: ["/uploads/hero.jpg"],
  },
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.ico" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  const { css, googleFontHref } = buildTokenStyle(settings);

  const ldLocalBusiness = localBusinessSchema(settings);
  const ldPerson = personSchema();
  const ldWebsite = websiteSchema();

  // Only load the extra Google Font when the admin picked a non-default family
  const usingDefaultFonts =
    settings.display_font === "Cormorant Garamond" && settings.body_font === "Inter";

  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        {/* Self-hosted default fonts via next/font are inlined automatically.
            Only fetch Google Fonts if the admin picked a custom family. */}
        {!usingDefaultFonts && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link href={googleFontHref} rel="stylesheet" />
          </>
        )}
        {/* Preload the hero LCP image so it appears immediately */}
        <link rel="preload" as="image" href="/uploads/hero.jpg" fetchPriority="high" />
        {/* hreflang */}
        <link rel="alternate" hrefLang="fr" href={siteUrl} />
        <link rel="alternate" hrefLang="en" href={siteUrl} />
        <link rel="alternate" hrefLang="x-default" href={siteUrl} />
        {/* Dynamic design tokens from settings */}
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(ldWebsite) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(ldLocalBusiness) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(ldPerson) }}
        />
      </head>
      <body>
        {children}
        <ModalProvider />
      </body>
    </html>
  );
}
