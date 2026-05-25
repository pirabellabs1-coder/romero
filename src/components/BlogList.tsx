"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import Rise from "@/components/Rise";
import Photo from "@/components/Photo";
import OrnamentDivider from "@/components/OrnamentDivider";
import { photoUrl } from "@/lib/photo-url";
import type { PostRow } from "@/lib/content";
import type { Lang, Strings } from "@/lib/i18n";

type Props = {
  posts: PostRow[];
  t: Strings;
  lang: Lang;
};

const CAT_MAP_EN: Record<string, string> = {
  WEDDINGS: "MARIAGES",
  VENUES: "LIEUX",
  TIPS: "CONSEILS",
};

export default function BlogList({ posts, t, lang }: Props) {
  const [cat, setCat] = useState(t.blog.categories[0]);

  const filtered = useMemo(() => {
    if (cat === t.blog.categories[0]) return posts;
    const matchFr = CAT_MAP_EN[cat] ?? cat;
    return posts.filter((p) => p.category === matchFr || p.category === cat);
  }, [cat, posts, t]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const title = (p: PostRow) => (lang === "en" && p.title_en ? p.title_en : p.title_fr);
  const excerpt = (p: PostRow) => (lang === "en" && p.excerpt_en ? p.excerpt_en : p.excerpt_fr);

  return (
    <>
      {/* CATEGORIES */}
      <section style={{ background: "var(--cream)", paddingBottom: 30 }}>
        <div className="container-wide" style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {t.blog.categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className="btn"
              style={{
                background: cat === c ? "var(--forest)" : "transparent",
                color: cat === c ? "#F4EFE3" : "var(--forest)",
                borderColor: cat === c ? "var(--forest)" : "var(--rule)",
                fontSize: 10,
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {featured && (
        <section style={{ background: "var(--cream)", padding: "40px 0 80px" }}>
          <div className="container-wide">
            <Rise>
              <Link href={`/blog/${featured.slug}`} className="responsive-2col tight" style={{ display: "grid" }}>
                <Photo src={photoUrl(featured.cover_filename)} label={title(featured)} ratio="4 / 3" />
                <div>
                  <div className="cap-tracked gold" style={{ marginBottom: 12 }}>
                    {t.blog.featured} · {featured.category}
                  </div>
                  <h2
                    className="serif"
                    style={{ fontSize: "clamp(28px, 3vw, 44px)", color: "var(--forest)", lineHeight: 1.15, fontWeight: 400, margin: 0 }}
                  >
                    {title(featured)}
                  </h2>
                  <OrnamentDivider />
                  <p className="muted" style={{ fontSize: 16, lineHeight: 1.7, marginTop: 18 }}>
                    {excerpt(featured)}
                  </p>
                  <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                    <span className="cap-tracked-sm muted">
                      {featured.published_at} · {featured.read_minutes} min
                    </span>
                    <span className="cap-tracked-sm gold">
                      {t.blog.readMore} →
                    </span>
                  </div>
                </div>
              </Link>
            </Rise>
          </div>
        </section>
      )}

      <section style={{ background: "var(--cream-deep)", padding: "90px 0" }}>
        <div className="container-wide responsive-3col">
          {rest.map((p, i) => (
            <Rise key={p.id} delay={i * 70}>
              <Link href={`/blog/${p.slug}`}>
                <article className="card" style={{ padding: 0, overflow: "hidden", height: "100%" }}>
                  <Photo
                    src={photoUrl(p.cover_filename)}
                    label={title(p).slice(0, 36)}
                    ratio="4 / 3"
                    rounded={false}
                  />
                  <div style={{ padding: "28px 28px 32px" }}>
                    <div className="cap-tracked-sm gold" style={{ marginBottom: 10 }}>
                      {p.category} · {p.published_at}
                    </div>
                    <h3 className="serif" style={{ fontSize: 22, color: "var(--forest)", lineHeight: 1.25, margin: 0, fontWeight: 400 }}>
                      {title(p)}
                    </h3>
                    <p className="muted" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 14 }}>
                      {excerpt(p)}
                    </p>
                    <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.read_minutes} min</span>
                      <span className="cap-tracked-sm gold">{t.blog.readMore} →</span>
                    </div>
                  </div>
                </article>
              </Link>
            </Rise>
          ))}
        </div>
      </section>
    </>
  );
}
