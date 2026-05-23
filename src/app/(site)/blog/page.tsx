import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";

export const metadata: Metadata = {
  title: "Journal — Carnets de la Riviera",
  description:
    "Conseils pour les futurs mariés, lieux de rêve sur la Côte d'Azur, coulisses de mariages. Un journal pour rêver, préparer, s'inspirer.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Journal — Romero Photography",
    description: "Conseils, lieux & inspirations pour votre mariage.",
    url: "/blog",
  },
};
import BlogList from "@/components/BlogList";
import CTABlock from "@/components/CTABlock";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { listPosts, pickShowcasePhotos } from "@/lib/content";

export default function BlogPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const posts = listPosts();
  // Provide a varied photo for any post without an uploaded cover
  const fallbackPhotos = pickShowcasePhotos(posts.length, "blog-covers-v1");
  const postsWithCover = posts.map((p, i) => ({
    ...p,
    cover_filename: p.cover_filename || fallbackPhotos[i] || null,
  }));

  return (
    <main>
      <PageEyebrow eyebrow={t.blog.eyebrow} title={t.blog.title} accent={t.blog.titleAccent} lead={t.blog.lead} />
      <BlogList posts={postsWithCover} t={t} lang={lang} />
      <CTABlock t={t} />
    </main>
  );
}
