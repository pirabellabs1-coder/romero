import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import OrnamentDivider from "@/components/OrnamentDivider";
import CTABlock from "@/components/CTABlock";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getPost, listPosts, postExcerpt, postTitle, pickShowcasePhotos, photoUrl } from "@/lib/content";
import { articleSchema, breadcrumbList, jsonLdScript } from "@/lib/jsonld";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPost(params.slug);
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
      images: p.cover_filename ? [{ url: photoUrl(p.cover_filename)! }] : undefined,
    },
  };
}

export default async function PostDetail({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post || !post.published) notFound();
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const title = postTitle(post, lang);
  const body = lang === "en" && post.body_en ? post.body_en : post.body_fr;
  const fallback = post.cover_filename ? null : (await pickShowcasePhotos(1, `post-cover-${post.slug}`))[0];
  const cover = post.cover_filename || fallback;

  // Related posts (latest 3 excluding current)
  const allPosts = await listPosts();
  const related = allPosts.filter((p) => p.id !== post.id).slice(0, 3);

  // JSON-LD for SEO
  const ldArticle = articleSchema({
    slug: post.slug,
    title,
    description: postExcerpt(post, lang) || title,
    publishedAt: post.published_at,
    image: cover ? photoUrl(cover)! : undefined,
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
                src={photoUrl(cover)!}
                alt={title}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: post.cover_position || "center center" }}
              />
            </div>
          </div>
        </section>
      )}

      {/* BODY */}
      <section style={{ background: "var(--cream)", padding: "40px 0 90px" }}>
        <div className="container" style={{ maxWidth: 760 }}>
          {body ? (
            // Sanitize the TipTap-produced HTML before render. Even though only
            // an authenticated admin can write it, defense-in-depth blocks any
            // <script>, <iframe>, on* handlers, etc. that might slip in.
            // sanitize-html runs natively in Node — no jsdom dependency so it
            // works fine in Vercel's serverless runtime.
            <div
              className="rich-prose"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(body, {
                  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
                    "img", "h1", "h2", "figure", "figcaption",
                  ]),
                  allowedAttributes: {
                    ...sanitizeHtml.defaults.allowedAttributes,
                    a: ["href", "name", "target", "rel"],
                    img: ["src", "alt", "title", "width", "height", "loading"],
                  },
                  allowedSchemes: ["http", "https", "mailto", "tel"],
                }),
              }}
            />
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
                        <img src={photoUrl(p.cover_filename)!} alt={postTitle(p, lang)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: p.cover_position || "center center" }} />
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
