import "@/styles/globals.css";
import type { Metadata } from "next";
import { getSettings, buildTokenStyle } from "@/lib/settings";
import ModalProvider from "@/components/ui/Modal";

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
    description: "Reportages de mariage élégants à Nice, sur la Côte d'Azur et au-delà.",
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

  const ldJson = {
    "@context": "https://schema.org",
    "@type": "Photograph",
    name: "Romero Photography",
    description: "Photographe de mariage à Nice & sur la Côte d'Azur.",
    url: siteUrl,
    image: `${siteUrl}/uploads/hero.jpg`,
    author: {
      "@type": "Person",
      name: "Mickael Romero",
      jobTitle: "Photographe de mariage",
      address: { "@type": "PostalAddress", addressLocality: "Nice", addressCountry: "FR" },
      email: settings.contact_email,
      telephone: settings.contact_phone,
    },
  };
  const ldLocalBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}#business`,
    name: "Romero Photography",
    url: siteUrl,
    image: `${siteUrl}/uploads/hero.jpg`,
    priceRange: "€€€",
    address: { "@type": "PostalAddress", addressLocality: settings.contact_city, addressCountry: "FR" },
    telephone: settings.contact_phone,
    email: settings.contact_email,
    areaServed: ["Nice", "Côte d'Azur", "France", "Worldwide"],
    sameAs: [
      `https://www.instagram.com/${(settings.instagram_handle || "").replace(/^@/, "")}`,
    ],
  };

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Single dynamic Google Fonts request — covers both serif + sans from current settings */}
        <link href={googleFontHref} rel="stylesheet" />
        {/* Preload the hero LCP image so it appears immediately */}
        <link rel="preload" as="image" href="/uploads/hero.jpg" fetchPriority="high" />
        {/* Dynamic design tokens from settings */}
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldLocalBusiness) }}
        />
      </head>
      <body>
        {children}
        <ModalProvider />
      </body>
    </html>
  );
}
