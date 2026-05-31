import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";
import PageSections from "@/components/PageSections";

export const metadata: Metadata = {
  title: "Le journal",
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
import { getStrings, type Strings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { listPosts, pickShowcasePhotos } from "@/lib/content";
import { getPageContent } from "@/lib/page-content";

export default async function BlogPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const posts = await listPosts();
  const [fallbackPhotos, ov] = await Promise.all([
    pickShowcasePhotos(posts.length, "blog-covers-v1"),
    getPageContent("blog", lang),
  ]);
  const postsWithCover = posts.map((p, i) => ({
    ...p,
    cover_filename: p.cover_filename || fallbackPhotos[i] || null,
  }));

  const tt: Strings = {
    ...t,
    blog: {
      ...t.blog,
      eyebrow:     ov.eyebrow     || t.blog.eyebrow,
      title:       ov.title       || t.blog.title,
      titleAccent: ov.titleAccent || t.blog.titleAccent,
      lead:        ov.lead        || t.blog.lead,
      readMore:    ov.readMore    || t.blog.readMore,
      featured:    ov.featured    || t.blog.featured,
      categories:  t.blog.categories.map((c, i) => ov[`categories_${i}`] || c) as Strings["blog"]["categories"],
    },
  };

  return (
    <main>
      <PageSections page="blog" slot="top" lang={lang} />
      <PageEyebrow eyebrow={tt.blog.eyebrow} title={tt.blog.title} accent={tt.blog.titleAccent} lead={tt.blog.lead} />
      <BlogList posts={postsWithCover} t={tt} lang={lang} />
      <CTABlock t={tt} />
      <PageSections page="blog" slot="bottom" lang={lang} />
    </main>
  );
}
