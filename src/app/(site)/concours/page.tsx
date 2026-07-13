import type { Metadata } from "next";
import Link from "next/link";
import PageEyebrow from "@/components/PageEyebrow";
import OrnamentDivider from "@/components/OrnamentDivider";
import Rise from "@/components/Rise";
import Photo from "@/components/Photo";
import StepNumber from "@/components/StepNumber";
import PageSections from "@/components/PageSections";
import { getLangFromCookies } from "@/lib/lang";
import { pickShowcasePhotos, photoUrl } from "@/lib/content";
import { getPageContent } from "@/lib/page-content";

export const metadata: Metadata = {
  title: "Le Grand Concours — Romero Photography",
  description:
    "Réservez votre mariage 2027 ou 2028 avec Romero Photography et tentez de gagner un safari en Tanzanie et 2 nuits à Zanzibar.",
  alternates: { canonical: "/concours" },
  openGraph: {
    title: "Le Grand Concours — Romero Photography",
    description:
      "Réservez votre mariage 2027 ou 2028 et tentez de gagner un voyage inoubliable : safari en Tanzanie + 2 nuits à Zanzibar.",
    url: "/concours",
  },
};

export default async function ConcoursPage() {
  const lang = getLangFromCookies();
  const [ov, showcase] = await Promise.all([
    getPageContent("concours", lang),
    pickShowcasePhotos(3, "concours-v1"),
  ]);

  // Photos éditables via CMS (/admin/content/concours), avec fallbacks élégants.
  const heroPortrait = ov["photo_portrait"] || photoUrl(showcase[0]) || "/uploads/hero.jpg";
  const heroPortraitFocal = ov["photo_portrait_focal"] || "center 30%";
  const prizeSafari = ov["photo_safari"] || photoUrl(showcase[1]) || "/uploads/hero.jpg";
  const prizeSafariFocal = ov["photo_safari_focal"] || "center center";
  const prizeZanzibar = ov["photo_zanzibar"] || photoUrl(showcase[2]) || "/uploads/hero.jpg";
  const prizeZanzibarFocal = ov["photo_zanzibar_focal"] || "center center";

  const formules = [
    {
      num: 1,
      title: "L’Essentielle",
      participations: 1,
      hint: "Reportage cœur de journée",
    },
    {
      num: 2,
      title: "Le Grand Jour",
      participations: 2,
      hint: "Reportage journée complète",
    },
    {
      num: 3,
      title: "Le Grand Classique",
      participations: 3,
      hint: "Journée complète + préparatifs",
    },
    {
      num: 4,
      title: "Prestige Éternel",
      participations: 5,
      hint: "Reportage intégral + album fine art",
    },
  ];

  const timeline = [
    {
      eyebrow: "01 · Rencontrez-moi",
      title: "Salon du mariage de Nice",
      body: "Je serai présent début novembre. Venez me rencontrer, échanger sur votre projet et découvrir mon univers en personne.",
    },
    {
      eyebrow: "02 · Tirage au sort",
      title: "Le 23 décembre",
      body: "Tirage effectué officiellement sous caméra, en toute transparence. Un notaire numérique atteste du résultat.",
    },
    {
      eyebrow: "03 · Annonce du gagnant",
      title: "Le 24 décembre — la magie de Noël",
      body: "La vidéo du tirage est publiée à 20 h pour préserver la surprise et offrir à un couple un cadeau inoubliable.",
    },
  ];

  return (
    <main>
      <PageSections page="concours" slot="top" lang={lang} />

      {/* ─────────────────────────── HERO ─────────────────────────── */}
      <section
        style={{
          position: "relative",
          background: "linear-gradient(180deg, var(--cream) 0%, var(--cream-deep) 100%)",
          padding: "90px 0 110px",
          overflow: "hidden",
        }}
      >
        {/* décor ornemental discret en fond */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -160,
            right: -160,
            width: 460,
            height: 460,
            border: "1px solid rgba(184, 151, 90, 0.25)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -220,
            left: -220,
            width: 520,
            height: 520,
            border: "1px solid rgba(184, 151, 90, 0.18)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        <div className="container-wide" style={{ position: "relative" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.15fr 0.85fr",
              gap: 60,
              alignItems: "center",
            }}
            className="concours-hero-grid"
          >
            {/* Colonne texte */}
            <Rise>
              <div>
                <div className="cap-tracked gold" style={{ marginBottom: 22 }}>
                  UN CADEAU DE NOËL EXCEPTIONNEL
                </div>
                <h1
                  className="serif"
                  style={{
                    fontSize: "clamp(48px, 6.5vw, 88px)",
                    lineHeight: 1.02,
                    color: "var(--forest)",
                    fontWeight: 400,
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  Le grand
                  <br />
                  <span style={{ fontStyle: "italic", color: "var(--gold)" }}>concours</span>
                </h1>
                <div style={{ marginTop: 26, marginBottom: 30 }}>
                  <OrnamentDivider width={72} />
                </div>
                <p
                  style={{
                    fontSize: 20,
                    lineHeight: 1.55,
                    color: "var(--forest)",
                    maxWidth: 520,
                    margin: 0,
                  }}
                >
                  Réservez votre mariage en{" "}
                  <span className="serif" style={{ fontStyle: "italic", color: "var(--gold-deep)", fontSize: 22 }}>
                    2027
                  </span>{" "}
                  ou{" "}
                  <span className="serif" style={{ fontStyle: "italic", color: "var(--gold-deep)", fontSize: 22 }}>
                    2028
                  </span>{" "}
                  et tentez de remporter un voyage inoubliable —{" "}
                  <em>safari en Tanzanie</em> et deux nuits à Zanzibar.
                </p>
                <div style={{ display: "flex", gap: 14, marginTop: 38, flexWrap: "wrap" }}>
                  <Link href="#formules" className="btn btn-forest" style={{ fontSize: 11 }}>
                    JE VEUX PARTICIPER
                  </Link>
                  <Link href="#gagner" className="btn btn-sage" style={{ fontSize: 11 }}>
                    DÉCOUVRIR LE PRIX
                  </Link>
                </div>
              </div>
            </Rise>

            {/* Colonne visuel */}
            <Rise delay={140}>
              <div
                style={{
                  position: "relative",
                  aspectRatio: "3 / 4",
                  maxWidth: 480,
                  marginLeft: "auto",
                }}
              >
                {/* cadre doré derrière */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: -18,
                    border: "1px solid var(--gold)",
                    opacity: 0.55,
                    pointerEvents: "none",
                  }}
                />
                <Photo src={heroPortrait} label="Mickael Romero — photographe de mariage" ratio="3 / 4" objectPosition={heroPortraitFocal} />
                {/* petit badge posé */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -32,
                    left: -32,
                    background: "var(--forest)",
                    color: "#F4EFE3",
                    padding: "18px 22px",
                    textAlign: "center",
                    boxShadow: "0 12px 30px rgba(46, 61, 46, 0.28)",
                  }}
                >
                  <div className="serif" style={{ fontStyle: "italic", fontSize: 15, color: "var(--gold-light)" }}>
                    Édition
                  </div>
                  <div className="serif" style={{ fontSize: 34, lineHeight: 1, marginTop: 4 }}>
                    2026
                  </div>
                </div>
              </div>
            </Rise>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── INTRO ─────────────────────────── */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <Rise>
            <div style={{ textAlign: "center" }}>
              <div className="cap-tracked gold">AVANT TOUTE CHOSE</div>
              <h2 className="h-section" style={{ marginTop: 14 }}>
                Le choix d’un photographe est <span style={{ fontStyle: "italic", color: "var(--gold)" }}>essentiel</span>
              </h2>
              <OrnamentDivider />
            </div>
          </Rise>
          <Rise delay={100}>
            <div
              style={{
                marginTop: 40,
                fontSize: 17,
                lineHeight: 1.85,
                color: "var(--ink)",
                textAlign: "center",
              }}
            >
              <p style={{ marginBottom: 22 }}>
                Il me paraît évident que l’on choisisse un photographe pour la qualité de son travail avant tout — et
                qu’il vous plaise sincèrement. Mon concours n’est pas là pour convaincre un couple de me signer sans
                aimer mon univers.
              </p>
              <p style={{ marginBottom: 22 }}>
                Il est là parce que si cela peut vous aider à franchir le pas quand mes formules correspondent à votre
                budget et que vous aviez déjà l’envie de travailler avec moi… alors autant vous offrir la chance de
                repartir avec un souvenir en plus.
              </p>
              <p style={{ fontStyle: "italic", color: "var(--gold-deep)", fontSize: 20 }}>
                « Une immense joie de faire gagner à l’un des couples avec qui je travaillerai un safari en Tanzanie et
                deux nuits à Zanzibar. »
              </p>
            </div>
          </Rise>
        </div>
      </section>

      {/* ─────────────────────── FORMULES / COMMENT ─────────────────────── */}
      <section id="formules" className="section-pad" style={{ background: "var(--cream-deep)" }}>
        <div className="container-wide">
          <Rise>
            <div style={{ textAlign: "center", marginBottom: 60 }}>
              <div className="cap-tracked gold">COMMENT PARTICIPER</div>
              <h2 className="h-section" style={{ marginTop: 14 }}>
                Vos chances augmentent avec la <span style={{ fontStyle: "italic", color: "var(--gold)" }}>formule choisie</span>
              </h2>
              <OrnamentDivider />
            </div>
          </Rise>

          <div className="concours-formules-grid">
            {formules.map((f, i) => (
              <Rise key={f.num} delay={i * 90}>
                <article
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid var(--rule)",
                    padding: "36px 26px 34px",
                    textAlign: "center",
                    position: "relative",
                    height: "100%",
                    boxSizing: "border-box",
                    transition: "transform 220ms ease, box-shadow 220ms ease, border-color 220ms",
                  }}
                  className="concours-card"
                >
                  <div className="cap-tracked" style={{ color: "var(--muted)", fontSize: 10 }}>
                    FORMULE 0{f.num}
                  </div>
                  <div
                    className="serif"
                    style={{ fontSize: 24, color: "var(--forest)", marginTop: 12, fontStyle: "italic" }}
                  >
                    {f.title}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "28px 0 18px" }}>
                    <div
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: "50%",
                        border: "1px solid var(--gold)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          inset: 6,
                          borderRadius: "50%",
                          border: "1px solid var(--gold)",
                          opacity: 0.4,
                        }}
                      />
                      <span
                        className="serif"
                        style={{
                          fontStyle: "italic",
                          fontSize: 48,
                          color: "var(--gold-deep)",
                          lineHeight: 1,
                        }}
                      >
                        {f.participations}
                      </span>
                    </div>
                  </div>
                  <div
                    className="cap-tracked-sm"
                    style={{ color: "var(--gold-deep)", fontSize: 10, marginBottom: 12 }}
                  >
                    {f.participations > 1 ? "PARTICIPATIONS" : "PARTICIPATION"}
                  </div>
                  <p
                    style={{
                      color: "var(--muted)",
                      fontSize: 13,
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {f.hint}
                  </p>
                </article>
              </Rise>
            ))}
          </div>

          {/* Encart explicatif */}
          <Rise delay={400}>
            <div
              style={{
                marginTop: 60,
                background: "linear-gradient(135deg, rgba(184, 151, 90, 0.10), rgba(184, 151, 90, 0.03))",
                border: "1px solid rgba(184, 151, 90, 0.35)",
                padding: "28px 34px",
                display: "flex",
                gap: 24,
                alignItems: "center",
                maxWidth: 900,
                marginLeft: "auto",
                marginRight: "auto",
              }}
              className="concours-info"
            >
              <div
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--gold)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                ✦
              </div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--ink)" }}>
                <strong style={{ color: "var(--forest)" }}>Pourquoi ?</strong> Parce que chaque prestation est
                différente. Plus une formule est complète, plus elle demande de temps, d’investissement, de préparation.
                C’est ma manière de remercier les couples qui me font confiance en leur offrant plus de chances de
                remporter ce voyage exceptionnel.
              </p>
            </div>
          </Rise>
        </div>
      </section>

      {/* ─────────────────────── DÉROULÉ / TIMELINE ─────────────────────── */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container-wide">
          <Rise>
            <div style={{ textAlign: "center", marginBottom: 70 }}>
              <div className="cap-tracked gold">LE DÉROULÉ DU CONCOURS</div>
              <h2 className="h-section" style={{ marginTop: 14 }}>
                Trois étapes, une <span style={{ fontStyle: "italic", color: "var(--gold)" }}>promesse</span>
              </h2>
              <OrnamentDivider />
            </div>
          </Rise>

          <div className="concours-timeline">
            <div className="concours-timeline__line" aria-hidden />
            {timeline.map((t, i) => (
              <Rise key={i} delay={i * 120}>
                <div style={{ textAlign: "center", position: "relative", zIndex: 1, padding: "0 18px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: 24,
                      background: "var(--cream)",
                    }}
                  >
                    <StepNumber n={i + 1} />
                  </div>
                  <div className="cap-tracked" style={{ color: "var(--gold)", fontSize: 11, marginBottom: 10 }}>
                    {t.eyebrow}
                  </div>
                  <div
                    className="serif"
                    style={{ fontSize: 22, color: "var(--forest)", fontStyle: "italic", marginBottom: 12 }}
                  >
                    {t.title}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, maxWidth: 320, margin: "0 auto" }}>
                    {t.body}
                  </p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────── À GAGNER ─────────────────────── */}
      <section
        id="gagner"
        style={{
          background: "var(--forest)",
          color: "#E5E1D8",
          padding: "110px 0 120px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="container-wide">
          <Rise>
            <div style={{ textAlign: "center", marginBottom: 70 }}>
              <div className="cap-tracked" style={{ color: "var(--gold-light)" }}>
                À GAGNER
              </div>
              <h2
                className="serif"
                style={{
                  fontSize: "clamp(38px, 4.5vw, 58px)",
                  lineHeight: 1.1,
                  color: "#F4EFE3",
                  fontWeight: 400,
                  marginTop: 14,
                }}
              >
                Un voyage <span style={{ fontStyle: "italic", color: "var(--gold-light)" }}>inoubliable</span>
              </h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 22 }}>
                <span style={{ display: "inline-block", width: 60, height: 1, background: "var(--gold)", opacity: 0.55 }} />
                <span
                  style={{ display: "inline-block", width: 6, height: 6, background: "var(--gold)", transform: "rotate(45deg)", margin: "0 12px" }}
                />
                <span style={{ display: "inline-block", width: 60, height: 1, background: "var(--gold)", opacity: 0.55 }} />
              </div>
            </div>
          </Rise>

          <div className="concours-prize-grid">
            <Rise>
              <div style={{ position: "relative" }}>
                <div style={{ overflow: "hidden" }}>
                  <Photo src={prizeSafari} label="Safari en Tanzanie" ratio="4 / 5" objectPosition={prizeSafariFocal} />
                </div>
                <div
                  style={{
                    marginTop: 28,
                    textAlign: "center",
                  }}
                >
                  <div className="cap-tracked" style={{ color: "var(--gold-light)", fontSize: 11 }}>
                    ÉTAPE 01
                  </div>
                  <div
                    className="serif"
                    style={{ fontSize: 30, color: "#F4EFE3", fontStyle: "italic", marginTop: 10 }}
                  >
                    Safari en Tanzanie
                  </div>
                  <p style={{ color: "#C9C2B4", fontSize: 14, lineHeight: 1.7, marginTop: 14, maxWidth: 380, margin: "14px auto 0" }}>
                    Une aventure d’exception sur les terres du Serengeti — Big Five, savane à perte de vue, nuits sous
                    les étoiles.
                  </p>
                </div>
              </div>
            </Rise>

            <Rise delay={140}>
              <div style={{ position: "relative" }}>
                <div style={{ overflow: "hidden" }}>
                  <Photo src={prizeZanzibar} label="Deux nuits à Zanzibar" ratio="4 / 5" objectPosition={prizeZanzibarFocal} />
                </div>
                <div
                  style={{
                    marginTop: 28,
                    textAlign: "center",
                  }}
                >
                  <div className="cap-tracked" style={{ color: "var(--gold-light)", fontSize: 11 }}>
                    ÉTAPE 02
                  </div>
                  <div
                    className="serif"
                    style={{ fontSize: 30, color: "#F4EFE3", fontStyle: "italic", marginTop: 10 }}
                  >
                    Deux nuits à Zanzibar
                  </div>
                  <p style={{ color: "#C9C2B4", fontSize: 14, lineHeight: 1.7, marginTop: 14, maxWidth: 380, margin: "14px auto 0" }}>
                    Sable blanc, eau turquoise, hôtel de charme — deux nuits pour se poser, savourer, revivre.
                  </p>
                </div>
              </div>
            </Rise>
          </div>
        </div>
      </section>

      {/* ─────────────────────── PARTENAIRE ─────────────────────── */}
      <section className="section-pad" style={{ background: "var(--cream-deep)" }}>
        <div className="container">
          <Rise>
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid var(--rule)",
                padding: "44px 46px",
                display: "flex",
                gap: 40,
                alignItems: "center",
                flexWrap: "wrap",
              }}
              className="concours-partner"
            >
              <div style={{ flex: "0 0 auto", textAlign: "center" }}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    border: "1px solid var(--gold)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                  }}
                >
                  <div
                    className="serif"
                    style={{ fontStyle: "italic", color: "var(--gold-deep)", fontSize: 34, lineHeight: 1 }}
                  >
                    SL
                  </div>
                </div>
                <div className="cap-tracked-sm gold" style={{ marginTop: 14 }}>
                  NOTRE PARTENAIRE
                </div>
                <div className="serif" style={{ fontSize: 18, color: "var(--forest)", marginTop: 6, fontStyle: "italic" }}>
                  SansanLaclak Travel
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.8, color: "var(--ink)" }}>
                  J’ai vécu cette aventure avec SansanLaclak Travel lors d’un voyage professionnel, et ce fut l’une des
                  plus belles expériences de ma vie. J’ai pu voir le Big Five, et bien plus encore que ce que j’imaginais
                  possible. J’ai passé une nuit chez les Massaï, rencontré des personnes incroyables, et découvert une
                  nature à couper le souffle.
                </p>
                <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.8, color: "var(--muted)", fontStyle: "italic" }}>
                  C’est donc tout naturellement que j’ai choisi de collaborer avec cette agence de confiance, qui a
                  accepté de me soutenir dans ce concours et de vous offrir ce voyage exceptionnel.
                </p>
              </div>
            </div>
          </Rise>
        </div>
      </section>

      {/* ─────────────────────── CTA FINAL ─────────────────────── */}
      <section style={{ background: "var(--sage-soft)", padding: "80px 0", borderTop: "1px solid var(--rule)" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 720 }}>
          <Rise>
            <div className="cap-tracked gold" style={{ marginBottom: 14 }}>
              PRÊT À TENTER VOTRE CHANCE ?
            </div>
            <div
              className="serif"
              style={{
                fontSize: "clamp(28px, 3.4vw, 36px)",
                color: "var(--forest)",
                lineHeight: 1.3,
                marginBottom: 32,
              }}
            >
              Si mon univers vous parle et que vous souhaitez participer,
              <br />
              <span style={{ fontStyle: "italic", color: "var(--gold)" }}>
                je serai honoré de raconter votre jour.
              </span>
            </div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link className="btn btn-forest" href="/prestations">
                DÉCOUVRIR MES PRESTATIONS
              </Link>
              <Link className="btn btn-sage" href="/contact">
                PARLONS DE VOTRE PROJET
              </Link>
            </div>
          </Rise>
        </div>
      </section>

      <PageSections page="concours" slot="bottom" lang={lang} />

      {/* Styles ciblés page-locale */}
      <style>{`
        .concours-formules-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .concours-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 40px rgba(46, 61, 46, 0.10);
          border-color: var(--gold);
        }
        .concours-timeline {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          position: relative;
        }
        .concours-timeline__line {
          position: absolute;
          top: 28px;
          left: 16.5%;
          right: 16.5%;
          height: 1px;
          background: var(--gold);
          opacity: 0.4;
          grid-column: 1 / -1;
          grid-row: 1;
        }
        .concours-prize-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
        }
        @media (max-width: 900px) {
          .concours-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 60px !important;
          }
          .concours-formules-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .concours-timeline {
            grid-template-columns: 1fr;
            gap: 50px;
          }
          .concours-timeline__line { display: none; }
          .concours-prize-grid {
            grid-template-columns: 1fr;
            gap: 60px;
          }
          .concours-partner {
            padding: 32px 24px !important;
            gap: 24px !important;
          }
          .concours-info {
            flex-direction: column;
            text-align: center;
            padding: 24px 20px !important;
          }
        }
        @media (max-width: 520px) {
          .concours-formules-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
