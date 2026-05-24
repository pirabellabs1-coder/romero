import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OrnamentDivider from "@/components/OrnamentDivider";
import CTABlock from "@/components/CTABlock";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getPost, listPosts, postExcerpt, postTitle, pickShowcasePhotos } from "@/lib/content";
import { articleSchema, breadcrumbList, jsonLdScript } from "@/lib/jsonld";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = getPost(params.slug);
  if (!p) return { title: "Article introuvable" };
  const lang = getLangFromCookies();
  const title = postTitle(p, lang);
  const desc = postExcerpt(p, lang) || `${title} — Romero Photography.`;
  return {
    title,
    description: desc,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: {
      title,
      description: desc,
      url: `/blog/${p.slug}`,
      type: "article",
      publishedTime: p.published_at,
      images: p.cover_filename ? [{ url: `/uploads/${p.cover_filename}` }] : undefined,
    },
  };
}

export default function PostDetail({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post || !post.published) notFound();
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const title = postTitle(post, lang);
  const body = lang === "en" && post.body_en ? post.body_en : post.body_fr;
  const cover = post.cover_filename || pickShowcasePhotos(1, `post-cover-${post.slug}`)[0];

  // Related posts (latest 3 excluding current)
  const related = listPosts()
    .filter((p) => p.id !== post.id)
    .slice(0, 3);

  // JSON-LD for SEO
  const ldArticle = articleSchema({
    slug: post.slug,
    title,
    description: postExcerpt(post, lang) || title,
    publishedAt: post.published_at,
    image: cover ? `/uploads/${cover}` : undefined,
    author: "Mickael Romero",
    category: post.category,
  });
  const ldBreadcrumb = breadcrumbList([
    { name: lang === "en" ? "Home" : "Accueil", url: "/" },
    { name: lang === "en" ? "Journal" : "Blog", url: "/blog" },
    { name: title, url: `/blog/${post.slug}` },
  ]);

  return (
    <main className="page-enter">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ldArticle) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ldBreadcrumb) }} />
      {/* HERO */}
      <section style={{ paddingTop: 160, paddingBottom: 60, background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 820, textAlign: "center" }}>
          <div className="cap-tracked gold" style={{ marginBottom: 18 }}>
            {post.category} · {post.published_at}
          </div>
          <h1 className="h-display" style={{ margin: 0, fontSize: "clamp(34px, 4.6vw, 60px)" }}>
            {title}
          </h1>
          <OrnamentDivider />
          {postExcerpt(post, lang) && (
            <p className="lead muted" style={{ marginTop: 18, marginLeft: "auto", marginRight: "auto" }}>
              {postExcerpt(post, lang)}
            </p>
          )}
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            {post.read_minutes} min
          </div>
        </div>
      </section>

      {/* COVER */}
      {cover && (
        <section style={{ background: "var(--cream)", paddingBottom: 40 }}>
          <div className="container-wide">
            <div style={{ aspectRatio: "16 / 9", overflow: "hidden", borderRadius: 4, maxHeight: 560 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/uploads/${cover}`}
                alt={title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          </div>
        </section>
      )}

      {/* BODY */}
      <section style={{ background: "var(--cream)", padding: "40px 0 90px" }}>
        <div className="container" style={{ maxWidth: 760 }}>
          {body ? (
            <div className="rich-prose" dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            <p className="muted" style={{ fontStyle: "italic", textAlign: "center" }}>
              {lang === "en" ? "This article hasn't been written yet." : "Cet article n'est pas encore rédigé."}
            </p>
          )}
        </div>
      </section>

      {/* RELATED */}
      {related.length > 0 && (
        <section style={{ background: "var(--cream-deep)", padding: "80px 0" }}>
          <div className="container-wide">
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div className="cap-tracked gold">À LIRE AUSSI</div>
              <OrnamentDivider />
            </div>
            <div className="responsive-3col">
              {related.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`}>
                  <article className="card" style={{ padding: 0, overflow: "hidden", height: "100%" }}>
                    {p.cover_filename && (
                      <div style={{ aspectRatio: "4 / 3", overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/uploads/${p.cover_filename}`} alt={postTitle(p, lang)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    <div style={{ padding: "24px 26px 28px" }}>
                      <div className="cap-tracked-sm gold" style={{ marginBottom: 8 }}>{p.category}</div>
                      <h3 className="serif" style={{ fontSize: 20, color: "var(--forest)", lineHeight: 1.25, margin: 0, fontWeight: 400 }}>
                        {postTitle(p, lang)}
                      </h3>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <Link href="/blog" className="btn btn-gold-outline">
                ← {lang === "en" ? "BACK TO JOURNAL" : "RETOUR AU JOURNAL"}
              </Link>
            </div>
          </div>
        </section>
      )}

      <CTABlock t={t} />
    </main>
  );
}
