import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";
import PageSections from "@/components/PageSections";

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
import { getPageContent } from "@/lib/page-content";

export default async function AboutPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const [eyebrowImg, storyImg, ov] = await Promise.all([
    pickShowcasePhotos(2, "about-v1").then((arr) => arr[0]),
    pickShowcasePhotos(2, "about-v1").then((arr) => arr[1]),
    getPageContent("about", lang),
  ]);
  // Admin-uploaded photos win over the random showcase picks.
  const eyebrowPhotoUrl = ov["photo_eyebrow"] || photoUrl(eyebrowImg);
  const storyPhotoUrl   = ov["photo_story"]   || photoUrl(storyImg);
  const eyebrowPhotoFocal = ov["photo_eyebrow_focal"] || "center center";
  const storyPhotoFocal   = ov["photo_story_focal"]   || "center center";
  const valueKinds: ValueKind[] = ["excellence", "detail", "emotion", "elegance"];

  // CMS overrides — merge over t.about per top-level scalar, plus expand
  // the flat indexed keys back into arrays.
  const about = { ...t.about };
  for (const k of Object.keys(about) as Array<keyof typeof about>) {
    const v = ov[k as string];
    if (typeof v === "string" && v.length > 0 && typeof about[k] === "string") {
      (about as Record<string, unknown>)[k as string] = v;
    }
  }
  const body = (t.about.body as ReadonlyArray<string>).map((p, i) => ov[`body_${i}`] || p);
  const values = (t.about.values as ReadonlyArray<[string, string]>).map(([titleDef, bodyDef], i) => [
    ov[`values_${i}_title`] || titleDef,
    ov[`values_${i}_body`] || bodyDef,
  ] as [string, string]);
  const process = (t.about.process as ReadonlyArray<[string, string]>).map(([titleDef, bodyDef], i) => [
    ov[`process_${i}_title`] || titleDef,
    ov[`process_${i}_body`] || bodyDef,
  ] as [string, string]);
  const gear = (t.about.gear as ReadonlyArray<string>).map((g, i) => ov[`gear_${i}`] || g);

  // CTA block (« Une question ? ») — let admin override the 3 strings.
  const ctaT = {
    ...t,
    cta: {
      question: ov["cta_question"] || t.cta.question,
      line1:    ov["cta_line1"]    || t.cta.line1,
      line2:    ov["cta_line2"]    || t.cta.line2,
    },
  };

  return (
    <main>
      <PageSections page="about" slot="top" lang={lang} />
      <PageEyebrow
        eyebrow={about.eyebrow}
        title={about.title}
        accent={about.titleAccent}
        lead={about.lead}
        image={{ src: eyebrowPhotoUrl, label: "Mickael en plein reportage", objectPosition: eyebrowPhotoFocal }}
      />

      {/* STORY */}
      <section className="section-pad" style={{ background: "#fff", borderTop: "1px solid var(--rule)" }}>
        <div className="container-wide">
          <div className="responsive-2col start">
            <Rise>
              <div style={{ position: "relative" }}>
                <Photo src={storyPhotoUrl} label="Mickael, atelier de retouche" ratio="3 / 4" objectPosition={storyPhotoFocal} />
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
                  {ov["story_quote"] || (lang === "en" ? "« Photographing is knowing how to wait. »" : "« Photographier, c’est savoir attendre. »")}
                </div>
              </div>
            </Rise>
            <Rise delay={120}>
              <div>
                <div className="cap-tracked gold">{about.bodyEyebrow}</div>
                <h2 className="h-section" style={{ marginTop: 14, marginBottom: 32 }}>
                  {about.bodyTitle}
                </h2>
                {body.map((p, i) => (
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
            <div className="cap-tracked gold">{about.valuesEyebrow}</div>
            <h2 className="h-section" style={{ marginTop: 14 }}>
              {about.valuesTitle}
            </h2>
            <OrnamentDivider />
          </div>
          <div className="responsive-4col">
            {values.map(([title, body], i) => (
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
            <div className="cap-tracked gold">{about.processEyebrow}</div>
            <h2 className="h-section" style={{ marginTop: 14 }}>
              {about.processTitle}
            </h2>
            <OrnamentDivider />
          </div>
          <div className="process-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, position: "relative" }}>
            <div className="process-line" />
            {process.map(([title, body], i) => (
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
                {about.gearEyebrow}
              </div>
              <h2 className="h-section" style={{ marginTop: 14, color: "#F4EFE3" }}>
                {about.gearTitle}
              </h2>
              <OrnamentDivider />
              <p style={{ marginTop: 24, color: "#C9C2B4", maxWidth: 460, lineHeight: 1.7 }}>{about.gearLead}</p>
            </div>
            <div className="gear-grid">
              {gear.map((g, i) => (
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

      <CTABlock t={ctaT} />
      <PageSections page="about" slot="bottom" lang={lang} />
    </main>
  );
}
