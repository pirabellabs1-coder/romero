import Link from "next/link";
import OrnamentDivider from "@/components/OrnamentDivider";
import Rise from "@/components/Rise";
import ValueIcon, { type ValueKind } from "@/components/ValueIcon";
import Photo from "@/components/Photo";
import Monogram from "@/components/Monogram";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { listGalleries, pickShowcasePhotos, coverFor } from "@/lib/content";

const HERO_PHOTO = "/uploads/hero.jpg";

export default function HomePage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const featured = listGalleries({ featuredOnly: true }).slice(0, 3);
  // 4 distinct photos for the services teaser tiles
  const teaserPhotos = pickShowcasePhotos(4, "home-teaser-v1");
  const valueKinds: ValueKind[] = ["authenticity", "elegance", "closeness", "excellence"];

  const firstCover = (i: number) => {
    const g = featured[i];
    return g ? coverFor(g, `home-featured-${g.slug}`) : null;
  };

  return (
    <main className="page-enter">
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden", background: "var(--cream)", paddingTop: 120 }}>
        <div className="watercolor" />
        <div className="hero-shell">
          <div className="hero-text">
            <div className="cap-tracked gold" style={{ marginBottom: 32 }}>
              {t.home.eyebrow}
            </div>
            <OrnamentDivider />
            <h1 className="h-display" style={{ marginTop: 28 }}>
              {t.home.title1}
              <br />
              <span style={{ fontStyle: "italic", color: "var(--gold)" }}>{t.home.title2}</span>
            </h1>
            <p className="lead" style={{ marginTop: 36, color: "var(--ink)", maxWidth: 480 }}>
              {t.home.sub}
            </p>

            <div style={{ marginTop: 48, display: "flex", gap: 18, flexWrap: "wrap" }}>
              <Link href="/portfolio" className="btn btn-sage">
                {t.home.cta}
              </Link>
              <Link href="/contact" className="btn btn-ghost">
                {t.book}
              </Link>
            </div>

            <div style={{ marginTop: 60, display: "flex", alignItems: "center", gap: 14, color: "var(--muted)", flexWrap: "wrap" }}>
              <span className="diamond" />
              <span style={{ fontSize: 11, letterSpacing: "0.32em", textTransform: "uppercase" }}>{t.home.locale}</span>
              <span className="diamond" />
            </div>
          </div>

          <div className="hero-photo-wrap">
            <div style={{ position: "relative", height: "100%", borderRadius: 4, overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_PHOTO}
                alt="Couple sous un voile"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
              />
              <div style={{ position: "absolute", top: 18, left: 18, width: 28, height: 28, borderTop: "1px solid var(--gold-light)", borderLeft: "1px solid var(--gold-light)", opacity: 0.85 }} />
              <div style={{ position: "absolute", top: 18, right: 18, width: 28, height: 28, borderTop: "1px solid var(--gold-light)", borderRight: "1px solid var(--gold-light)", opacity: 0.85 }} />
              <div style={{ position: "absolute", bottom: 18, left: 18, width: 28, height: 28, borderBottom: "1px solid var(--gold-light)", borderLeft: "1px solid var(--gold-light)", opacity: 0.85 }} />
              <div style={{ position: "absolute", bottom: 18, right: 18, width: 28, height: 28, borderBottom: "1px solid var(--gold-light)", borderRight: "1px solid var(--gold-light)", opacity: 0.85 }} />
            </div>
          </div>
        </div>
      </section>

      {/* VALUES BAND */}
      <section
        className="section-pad-sm"
        style={{ background: "var(--cream-deep)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}
      >
        <div className="container-wide">
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="cap-tracked gold">{t.home.valuesEyebrow}</div>
            <h2 className="h-section" style={{ marginTop: 18 }}>
              {t.home.valuesTitle}
            </h2>
            <OrnamentDivider />
          </div>
          <div className="values-band">
            {t.home.values.map(([title, body], i) => (
              <Rise key={i} delay={i * 60}>
                <div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                    <ValueIcon kind={valueKinds[i]} />
                  </div>
                  <div className="cap-tracked" style={{ color: "var(--forest)", marginBottom: 12 }}>
                    {title}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.65, margin: 0, maxWidth: 220, marginLeft: "auto", marginRight: "auto" }}>
                    {body}
                  </p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED WEDDINGS */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container-wide">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 50, flexWrap: "wrap", gap: 24 }}>
            <div>
              <div className="cap-tracked gold">{t.home.featuredEyebrow}</div>
              <h2 className="h-section" style={{ marginTop: 14 }}>
                {t.home.featuredTitle}
              </h2>
            </div>
            <Link href="/portfolio" className="btn btn-gold-outline">
              {t.home.featuredCta}
            </Link>
          </div>

          <div className="featured-grid">
            <Rise>
              <Link href={featured[0] ? `/portfolio/${featured[0].slug}` : "/portfolio"}>
                <div style={{ position: "relative", cursor: "pointer" }}>
                  <div style={{ aspectRatio: "4 / 5", overflow: "hidden" }}>
                    {firstCover(0) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firstCover(0)!} alt={featured[0]?.names ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Photo label={featured[0]?.names ?? "Mariage"} ratio="4 / 5" rounded={false} />
                    )}
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div className="cap-tracked-sm gold">
                      {featured[0]?.region} — {(featured[0]?.place ?? "").toUpperCase().split(",")[0]}
                    </div>
                    <div className="serif" style={{ fontSize: 28, color: "var(--forest)", marginTop: 6, fontWeight: 400 }}>
                      {featured[0]?.names ?? ""}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{featured[0]?.date_label}</div>
                  </div>
                </div>
              </Link>
            </Rise>

            {[1, 2].map((i) => (
              <Rise key={i} delay={i === 1 ? 80 : 140}>
                <Link href={featured[i] ? `/portfolio/${featured[i].slug}` : "/portfolio"}>
                  <div style={{ cursor: "pointer" }}>
                    {firstCover(i) ? (
                      <div style={{ aspectRatio: "4 / 5", overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={firstCover(i)!} alt={featured[i]?.names ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    ) : (
                      <Photo label={`${featured[i]?.names ?? ""} · ${featured[i]?.place ?? ""}`} ratio="4 / 5" />
                    )}
                    <div style={{ marginTop: 16 }}>
                      <div className="cap-tracked-sm gold">
                        {featured[i]?.region} — {(featured[i]?.place ?? "").toUpperCase().split(",")[0]}
                      </div>
                      <div className="serif" style={{ fontSize: 22, color: "var(--forest)", marginTop: 4 }}>
                        {featured[i]?.names ?? ""}
                      </div>
                    </div>
                  </div>
                </Link>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* QUOTE BAND */}
      <section style={{ background: "var(--sage-soft)", padding: "110px 0", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 50% 80% at 50% 50%, rgba(255,255,255,.5), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div className="container" style={{ textAlign: "center", position: "relative" }}>
          <Monogram size={56} label={false} />
          <OrnamentDivider />
          <p
            className="serif"
            style={{
              fontSize: "clamp(24px, 2.6vw, 36px)",
              color: "var(--forest)",
              lineHeight: 1.4,
              marginTop: 36,
              fontStyle: "italic",
              maxWidth: 880,
              margin: "36px auto 24px",
            }}
          >
            {t.home.bandQuote}
          </p>
          <div className="cap-tracked-sm gold" style={{ marginTop: 18 }}>
            {t.home.bandAttr}
          </div>
        </div>
      </section>

      {/* SERVICES TEASER */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container-wide">
          <div className="responsive-2col">
            <Rise>
              <div>
                <div className="cap-tracked gold">{t.nav.services}</div>
                <h2 className="h-section" style={{ marginTop: 14 }}>
                  {t.services.title}{" "}
                  <span className="italic-gold" style={{ fontStyle: "italic" }}>
                    {t.services.titleAccent}
                  </span>
                </h2>
                <OrnamentDivider />
                <p className="lead muted" style={{ marginTop: 24 }}>
                  {t.services.lead}
                </p>
                <Link href="/prestations" className="btn btn-sage" style={{ marginTop: 32 }}>
                  {t.services.cta}
                </Link>
              </div>
            </Rise>
            <Rise delay={120}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Photo src={teaserPhotos[0] ? `/uploads/${teaserPhotos[0]}` : null} label="préparatifs" ratio="3 / 4" />
                <Photo src={teaserPhotos[1] ? `/uploads/${teaserPhotos[1]}` : null} label="cérémonie" ratio="3 / 4" style={{ marginTop: 40 }} />
                <Photo src={teaserPhotos[2] ? `/uploads/${teaserPhotos[2]}` : null} label="cocktail" ratio="3 / 4" style={{ marginTop: -20 }} />
                <Photo src={teaserPhotos[3] ? `/uploads/${teaserPhotos[3]}` : null} label="première danse" ratio="3 / 4" style={{ marginTop: 20 }} />
              </div>
            </Rise>
          </div>
        </div>
      </section>
    </main>
  );
}
