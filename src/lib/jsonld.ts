/**
 * Helpers to build clean schema.org JSON-LD blobs for SEO.
 * All return a plain object that can be JSON.stringified into a
 * <script type="application/ld+json"> tag.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function breadcrumbList(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${siteUrl}${it.url}`,
    })),
  };
}

export function articleSchema(p: {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  image?: string;
  author?: string;
  category?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.description,
    image: p.image ? [p.image.startsWith("http") ? p.image : `${siteUrl}${p.image}`] : undefined,
    datePublished: p.publishedAt,
    dateModified: p.publishedAt,
    author: { "@type": "Person", name: p.author || "Mickael Romero" },
    publisher: {
      "@type": "Organization",
      name: "Romero Photography",
      logo: { "@type": "ImageObject", url: `${siteUrl}/uploads/hero.jpg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/blog/${p.slug}` },
    articleSection: p.category,
  };
}

export function imageGallerySchema(g: {
  slug: string;
  names: string;
  place: string;
  date: string;
  intro: string;
  images: Array<{ filename: string; alt?: string }>;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `${g.names} — ${g.place}`,
    description: g.intro || `Reportage du mariage de ${g.names} à ${g.place}.`,
    url: `${siteUrl}/portfolio/${g.slug}`,
    dateCreated: g.date,
    author: { "@type": "Person", name: "Mickael Romero" },
    image: g.images.slice(0, 12).map((img) => ({
      "@type": "ImageObject",
      contentUrl: img.filename.startsWith("http") ? img.filename : `${siteUrl}/uploads/${img.filename}`,
      caption: img.alt || `${g.names} - ${g.place}`,
    })),
  };
}

export function localBusinessSchema(settings: {
  contact_email: string;
  contact_phone: string;
  contact_city: string;
  instagram_handle: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}#business`,
    name: "Romero Photography",
    url: siteUrl,
    image: `${siteUrl}/uploads/hero.jpg`,
    priceRange: "€€€",
    address: {
      "@type": "PostalAddress",
      addressLocality: settings.contact_city,
      addressCountry: "FR",
    },
    telephone: settings.contact_phone,
    email: settings.contact_email,
    areaServed: ["Nice", "Côte d'Azur", "France", "Worldwide"],
    sameAs: [
      `https://www.instagram.com/${(settings.instagram_handle || "").replace(/^@/, "")}`,
    ],
    geo: { "@type": "GeoCoordinates", latitude: 43.7102, longitude: 7.262 },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "19:00",
      },
    ],
  };
}

export function personSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Mickael Romero",
    jobTitle: "Photographe de mariage",
    description: "Photographe de mariage à Nice & sur la Côte d'Azur.",
    url: `${siteUrl}/a-propos`,
    image: `${siteUrl}/uploads/hero.jpg`,
    worksFor: { "@type": "Organization", name: "Romero Photography" },
    address: { "@type": "PostalAddress", addressLocality: "Nice", addressCountry: "FR" },
  };
}

export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: siteUrl,
    name: "Romero Photography",
    description: "Photographe de mariage à Nice & sur la Côte d'Azur.",
    inLanguage: ["fr-FR", "en-GB"],
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/portfolio?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Renders a JSON-LD script tag-safe string. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
