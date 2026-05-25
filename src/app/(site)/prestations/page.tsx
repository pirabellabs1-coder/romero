import type { Metadata } from "next";
import Link from "next/link";
import PageEyebrow from "@/components/PageEyebrow";

export const metadata: Metadata = {
  title: "Prestations & tarifs",
  description:
    "Reportage complet de mariage, séances couple, événements privés. Reportages sur la Côte d'Azur et à l'international.",
  alternates: { canonical: "/prestations" },
  openGraph: {
    title: "Prestations & tarifs — Romero Photography",
    description: "Reportage mariage, séance couple, événements privés.",
    url: "/prestations",
  },
};
import OrnamentDivider from "@/components/OrnamentDivider";
import Rise from "@/components/Rise";
import Photo from "@/components/Photo";
import CTABlock from "@/components/CTABlock";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { pickShowcasePhotos, photoUrl } from "@/lib/content";

const HERO_PHOTO = "/uploads/hero.jpg";

export default function ServicesPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  // 1 hero + 3 card images + 1 zoom image + 4 gallery tiles = 9 distinct photos
  const allShots = pickShowcasePhotos(9, "prestations-v2");
  const heroImg = allShots[0];
  const cardPhotos = allShots.slice(1, 4);
  // Pin a dedicated "event" photo on the 3rd card (Événement privé) — different
  // wedding pool so it visually contrasts with the bride-focused cards 1 & 2.
  const eventCardPhoto = pickShowcasePhotos(1, "event-card-v1")[0];
  if (eventCardPhoto) cardPhotos[2] = eventCardPhoto;
  const zoomImg = allShots[4];
  const galleryPhotos = allShots.slice(5, 9);

  return (
    <main>
      <PageEyebrow
        eyebrow={t.services.eyebrow}
        title={t.services.title}
        accent={t.services.titleAccent}
        lead={t.services.lead}
        image={{ src: photoUrl(heroImg), label: "bouquet de pivoines", objectPosition: "center 30%" }}
      />

      {/* CARDS */}
      <section className="section-pad" style={{ background: "#fff" }}>
        <div className="container-wide">
          <div className="responsive-3col">
            {t.services.cards.map(([title, sub, price, body], i) => (
              <Rise key={i} delay={i * 80}>
                <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", padding: 0, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "4 / 3" }}>
                    <Photo
                      src={photoUrl(cardPhotos[i])}
                      label={["Reportage mariage", "Séance couple", "Événement privé"][i]}
                      rounded={false}
                      ratio="4 / 3"
                    />
                  </div>
                  <div style={{ padding: "36px 30px 32px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div className="cap-tracked-sm gold" style={{ marginBottom: 12 }}>
                      FORMULE 0{i + 1}
                    </div>
                    <h3 className="h-card" style={{ margin: 0 }}>
                      {title}
                    </h3>
                    <div className="serif" style={{ fontStyle: "italic", color: "var(--gold)", fontSize: 16, marginTop: 8 }}>
                      {sub}
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, marginTop: 22, flex: 1 }}>{body}</p>
                    <div
                      style={{
                        borderTop: "1px solid var(--rule)",
                        marginTop: 22,
                        paddingTop: 18,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span className="serif" style={{ fontSize: 18, color: "var(--forest)" }}>
                        {price}
                      </span>
                      <Link href="/contact" className="cap-tracked-sm gold">
                        EN SAVOIR PLUS →
                      </Link>
                    </div>
                  </div>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* ZOOM */}
      <section className="section-pad" style={{ background: "var(--cream-deep)" }}>
        <div className="container-wide">
          <div className="responsive-2col start">
            <Rise>
              <div>
                <div className="cap-tracked gold">{t.services.zoomEyebrow}</div>
                <h2 className="h-section" style={{ marginTop: 14 }}>
                  {t.services.zoomTitle}
                </h2>
                <OrnamentDivider />
                <p className="lead muted" style={{ marginTop: 16, marginBottom: 36 }}>
                  {t.services.zoomIntro}
                </p>
                <Photo src={photoUrl(zoomImg) ?? HERO_PHOTO} ratio="3 / 2" alt="Reportage" />
              </div>
            </Rise>
            <Rise delay={120}>
              <div style={{ marginTop: 50 }}>
                {t.services.includes.map(([title, body], i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "40px 1fr",
                      gap: 22,
                      padding: "22px 0",
                      borderBottom: i < t.services.includes.length - 1 ? "1px solid var(--rule)" : "none",
                    }}
                  >
                    <div className="serif" style={{ color: "var(--gold)", fontStyle: "italic", fontSize: 22, paddingTop: 2 }}>
                      0{i + 1}
                    </div>
                    <div>
                      <div className="serif" style={{ fontSize: 19, color: "var(--forest)", marginBottom: 4 }}>
                        {title}
                      </div>
                      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Rise>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container-wide">
          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <div className="cap-tracked gold">{t.services.galleryEyebrow}</div>
            <OrnamentDivider />
          </div>
          <div className="responsive-4col">
            {[0, 1, 2, 3].map((i) => (
              <Rise key={i} delay={i * 60}>
                <Photo
                  src={photoUrl(galleryPhotos[i])}
                  label={["cérémonie", "détails", "préparatifs", "soirée"][i]}
                  ratio="3 / 4"
                />
              </Rise>
            ))}
          </div>
        </div>
      </section>

      <CTABlock t={t} />
    </main>
  );
}
