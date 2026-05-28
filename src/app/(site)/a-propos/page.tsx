import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";

export const metadata: Metadata = {
  title: "À propos — Mickael Romero",
  description:
    "Mickael Romero, photographe de mariage à Nice. Une approche sensible, élégante et intemporelle. Découvrez sa story, ses valeurs et son processus.",
  alternates: { canonical: "/a-propos" },
  openGraph: {
    title: "À propos — Mickael Romero",
    description: "Photographe de mariage à Nice — story, valeurs, processus.",
    url: "/a-propos",
  },
};
import OrnamentDivider from "@/components/OrnamentDivider";
import Rise from "@/components/Rise";
import ValueIcon, { type ValueKind } from "@/components/ValueIcon";
import StepNumber from "@/components/StepNumber";
import Photo from "@/components/Photo";
import CTABlock from "@/components/CTABlock";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { pickShowcasePhotos, photoUrl } from "@/lib/content";

export default async function AboutPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  // 1 eyebrow image + 1 story image = 2 distinct photos
  const [eyebrowImg, storyImg] = await pickShowcasePhotos(2, "about-v1");
  const valueKinds: ValueKind[] = ["excellence", "detail", "emotion", "elegance"];

  return (
    <main>
      <PageEyebrow
        eyebrow={t.about.eyebrow}
        title={t.about.title}
        accent={t.about.titleAccent}
        lead={t.about.lead}
        image={{ src: photoUrl(eyebrowImg), label: "Mickael en plein reportage" }}
      />

      {/* STORY */}
      <section className="section-pad" style={{ background: "#fff", borderTop: "1px solid var(--rule)" }}>
        <div className="container-wide">
          <div className="responsive-2col start">
            <Rise>
              <div style={{ position: "relative" }}>
                <Photo src={photoUrl(storyImg)} label="Mickael, atelier de retouche" ratio="3 / 4" />
                <div
                  style={{
                    position: "absolute",
                    bottom: -30,
                    right: -30,
                    background: "var(--cream-deep)",
                    border: "1px solid var(--gold)",
                    padding: "24px 28px",
                    fontFamily: "var(--serif)",
                    color: "var(--forest)",
                    fontStyle: "italic",
                    maxWidth: 220,
                    fontSize: 17,
                    lineHeight: 1.4,
                  }}
                >
                  « Photographier, c&apos;est savoir attendre. »
                </div>
              </div>
            </Rise>
            <Rise delay={120}>
              <div>
                <div className="cap-tracked gold">{t.about.bodyEyebrow}</div>
                <h2 className="h-section" style={{ marginTop: 14, marginBottom: 32 }}>
                  {t.about.bodyTitle}
                </h2>
                {t.about.body.map((p, i) => (
                  <p key={i} className="body" style={{ fontSize: 16, lineHeight: 1.85, color: "var(--ink)", marginBottom: 22 }}>
                    {p}
                  </p>
                ))}
                <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ width: 110, height: 1, background: "var(--gold)" }} />
                  <span className="serif" style={{ fontStyle: "italic", fontSize: 22, color: "var(--forest)" }}>
                    Mickael Romero
                  </span>
                </div>
              </div>
            </Rise>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="section-pad" style={{ background: "var(--cream-deep)" }}>
        <div className="container-wide">
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div className="cap-tracked gold">{t.about.valuesEyebrow}</div>
            <h2 className="h-section" style={{ marginTop: 14 }}>
              {t.about.valuesTitle}
            </h2>
            <OrnamentDivider />
          </div>
          <div className="responsive-4col">
            {t.about.values.map(([title, body], i) => (
              <Rise key={i} delay={i * 70}>
                <div className="card" style={{ textAlign: "center", padding: "44px 26px" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
                    <ValueIcon kind={valueKinds[i]} size={42} />
                  </div>
                  <div className="cap-tracked" style={{ color: "var(--forest)", marginBottom: 14 }}>
                    {title}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
                    {body}
                  </p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container-wide">
          <div style={{ textAlign: "center", marginBottom: 70 }}>
            <div className="cap-tracked gold">{t.about.processEyebrow}</div>
            <h2 className="h-section" style={{ marginTop: 14 }}>
              {t.about.processTitle}
            </h2>
            <OrnamentDivider />
          </div>
          <div className="process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, position: "relative" }}>
            <div className="process-line" />
            {t.about.process.map(([title, body], i) => (
              <Rise key={i} delay={i * 90}>
                <div style={{ padding: "0 22px", textAlign: "center", position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 22, background: "var(--cream)" }}>
                    <StepNumber n={i + 1} />
                  </div>
                  <div className="cap-tracked" style={{ color: "var(--forest)", marginBottom: 14 }}>
                    {title}
                  </div>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: 13.5,
                      lineHeight: 1.7,
                      margin: 0,
                      maxWidth: 240,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    {body}
                  </p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* GEAR */}
      <section className="section-pad" style={{ background: "var(--forest)", color: "#E5E1D8" }}>
        <div className="container-wide">
          <div className="responsive-2col">
            <div>
              <div className="cap-tracked" style={{ color: "var(--gold-light)" }}>
                {t.about.gearEyebrow}
              </div>
              <h2 className="h-section" style={{ marginTop: 14, color: "#F4EFE3" }}>
                {t.about.gearTitle}
              </h2>
              <OrnamentDivider />
              <p style={{ marginTop: 24, color: "#C9C2B4", maxWidth: 460, lineHeight: 1.7 }}>{t.about.gearLead}</p>
            </div>
            <div className="gear-grid">
              {t.about.gear.map((g, i) => (
                <Rise key={i} delay={i * 60}>
                  <div
                    style={{
                      padding: "22px 24px",
                      border: "1px solid rgba(212, 185, 122, 0.25)",
                      borderLeft: "2px solid var(--gold-light)",
                      background: "rgba(255,255,255,.02)",
                      fontSize: 14,
                      color: "#E0DACE",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {g}
                  </div>
                </Rise>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTABlock t={t} />
    </main>
  );
}
