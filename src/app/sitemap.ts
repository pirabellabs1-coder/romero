import type { MetadataRoute } from "next";
import { listGalleries, listPosts } from "@/lib/content";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/prestations`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/portfolio`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/avis`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.9 },
  ];

  const galleryUrls: MetadataRoute.Sitemap = listGalleries().map((g) => ({
    url: `${siteUrl}/portfolio/${g.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const postUrls: MetadataRoute.Sitemap = listPosts().map((p) => ({
    url: `${siteUrl}/blog/${p.slug}`,
    lastModified: new Date(p.published_at),
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...galleryUrls, ...postUrls];
}
