import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";

export const metadata: Metadata = {
  title: "Avis clients",
  description:
    "Témoignages de mariés photographiés par Romero Photography. Note 5/5 sur Google, plus de 87 avis clients.",
  alternates: { canonical: "/avis" },
  openGraph: {
    title: "Avis clients — Romero Photography",
    description: "Ils m'ont fait confiance pour leur mariage.",
    url: "/avis",
  },
};
import OrnamentDivider from "@/components/OrnamentDivider";
import Stars from "@/components/Stars";
import GoogleG from "@/components/GoogleG";
import ReviewsCarousel from "@/components/ReviewsCarousel";
import CTABlock from "@/components/CTABlock";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { listReviews } from "@/lib/content";

export default function ReviewsPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const reviews = listReviews();

  return (
    <main>
      <PageEyebrow eyebrow={t.reviews.eyebrow} title={t.reviews.title} accent={t.reviews.titleAccent} lead={t.reviews.lead} />

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
          {t.reviews.stats.map(([num, label], i) => (
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
            <div className="cap-tracked gold">{t.reviews.live}</div>
            <h2 className="h-section" style={{ marginTop: 14 }}>
              {t.reviews.liveTitle}
            </h2>
            <OrnamentDivider />
          </div>

          <ReviewsCarousel reviews={reviews} lang={lang} />

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <button className="btn btn-gold-outline">
              <GoogleG /> &nbsp; {t.reviews.googleCta}
            </button>
          </div>
        </div>
      </section>

      <CTABlock t={t} />
    </main>
  );
}
