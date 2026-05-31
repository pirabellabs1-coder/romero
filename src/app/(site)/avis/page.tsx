import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";
import OrnamentDivider from "@/components/OrnamentDivider";
import Stars from "@/components/Stars";
import GoogleG from "@/components/GoogleG";
import ReviewsCarousel from "@/components/ReviewsCarousel";
import CTABlock from "@/components/CTABlock";
import Monogram from "@/components/Monogram";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getSettings } from "@/lib/settings";
import { listReviews } from "@/lib/content";
import PageSections from "@/components/PageSections";

export const metadata: Metadata = {
  title: "Avis clients",
  description:
    "Témoignages de mariés photographiés par Romero Photography à Nice & sur la Côte d'Azur.",
  alternates: { canonical: "/avis" },
  openGraph: {
    title: "Avis clients — Romero Photography",
    description: "Ils m'ont fait confiance pour leur mariage.",
    url: "/avis",
  },
};

export default async function ReviewsPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const [reviews, settings, ov] = await Promise.all([
    listReviews(),
    getSettings(),
    (await import("@/lib/page-content")).getPageContent("reviews", lang),
  ]);
  const googleUrl = settings.google_reviews_url || "https://www.google.com/maps/search/?api=1&query=Romero+Photography+Nice";

  const r = {
    eyebrow:     ov.eyebrow     || t.reviews.eyebrow,
    title:       ov.title       || t.reviews.title,
    titleAccent: ov.titleAccent || t.reviews.titleAccent,
    lead:        ov.lead        || t.reviews.lead,
    googleCta:   ov.googleCta   || t.reviews.googleCta,
    live:        ov.live        || t.reviews.live,
    liveTitle:   ov.liveTitle   || t.reviews.liveTitle,
    stats: (t.reviews.stats as ReadonlyArray<[string, string]>).map(([vDef, lDef], i) => [
      ov[`stats_${i}_value`] || vDef,
      ov[`stats_${i}_label`] || lDef,
    ] as [string, string]),
  };

  return (
    <main>
      <PageSections page="reviews" slot="top" lang={lang} />
      <PageEyebrow eyebrow={r.eyebrow} title={r.title} accent={r.titleAccent} lead={r.lead} />

      {reviews.length > 0 ? (
        <>
          {/* STATS */}
          <section style={{ background: "var(--cream)", paddingBottom: 80 }}>
            <div
              className="container responsive-3col"
              style={{
                borderTop: "1px solid var(--rule)",
                borderBottom: "1px solid var(--rule)",
                padding: "40px 0",
              }}
            >
              {r.stats.map(([num, label], i) => (
                <div
                  key={i}
                  style={{ textAlign: "center", borderRight: i < 2 ? "1px solid var(--rule)" : "none", padding: "0 20px" }}
                >
                  <div className="serif" style={{ fontSize: 56, color: "var(--forest)", lineHeight: 1, fontWeight: 400 }}>
                    {num}
                  </div>
                  {i === 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Stars rating={5} size={16} />
                    </div>
                  )}
                  <div className="cap-tracked-sm gold" style={{ marginTop: 14 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CAROUSEL */}
          <section style={{ background: "var(--cream-deep)", padding: "90px 0", position: "relative" }}>
            <div className="container-wide">
              <div style={{ textAlign: "center", marginBottom: 60 }}>
                <div className="cap-tracked gold">{r.live}</div>
                <h2 className="h-section" style={{ marginTop: 14 }}>
                  {r.liveTitle}
                </h2>
                <OrnamentDivider />
              </div>

              <ReviewsCarousel reviews={reviews} lang={lang} />

              <div style={{ textAlign: "center", marginTop: 40 }}>
                <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="btn btn-gold-outline">
                  <GoogleG /> &nbsp; {r.googleCta}
                </a>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Empty state: real Google CTA */
        <section style={{ background: "var(--cream-deep)", padding: "100px 0 120px" }}>
          <div className="container" style={{ maxWidth: 720, textAlign: "center" }}>
            <Monogram size={56} label={false} />
            <OrnamentDivider />
            <h2 className="h-section" style={{ marginTop: 10 }}>
              {lang === "en" ? (
                <>Read the reviews <span className="italic-gold" style={{ fontStyle: "italic" }}>on Google</span></>
              ) : (
                <>Tous les avis <span className="italic-gold" style={{ fontStyle: "italic" }}>sur Google</span></>
              )}
            </h2>
            <p className="lead muted" style={{ marginTop: 22, marginLeft: "auto", marginRight: "auto" }}>
              {lang === "en"
                ? "Read what real couples say about their experience with Romero Photography directly on Google."
                : "Découvrez les témoignages des couples que j'ai eu l'honneur de photographier, directement sur Google."}
            </p>
            <div style={{ marginTop: 36, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sage">
                <GoogleG /> &nbsp; {lang === "en" ? "READ REVIEWS ON GOOGLE" : "VOIR LES AVIS GOOGLE"}
              </a>
              <a href={googleUrl + "&review=true"} target="_blank" rel="noopener noreferrer" className="btn btn-gold-outline">
                {lang === "en" ? "LEAVE A REVIEW" : "LAISSER UN AVIS"}
              </a>
            </div>
          </div>
        </section>
      )}

      <CTABlock t={t} />
      <PageSections page="reviews" slot="bottom" lang={lang} />
    </main>
  );
}
