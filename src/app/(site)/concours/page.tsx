import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import OrnamentDivider from "@/components/OrnamentDivider";
import Rise from "@/components/Rise";
import StepNumber from "@/components/StepNumber";
import PageSections from "@/components/PageSections";
import ConcoursVideo from "@/components/ConcoursVideo";
import { getLangFromCookies } from "@/lib/lang";

export const metadata: Metadata = {
  title: "Le Grand Concours — Romero Photography",
  description:
    "Réservez votre mariage en 2027 ou 2028 avec Romero Photography et tentez de gagner un safari en Tanzanie et 2 nuits à Zanzibar.",
  alternates: { canonical: "/concours" },
  openGraph: {
    title: "Le Grand Concours — Romero Photography",
    description:
      "Réservez votre mariage 2027 ou 2028 et tentez de gagner un voyage inoubliable : safari en Tanzanie + 2 nuits à Zanzibar.",
    url: "/concours",
    images: ["/uploads/concours/safari-tanzanie.png"],
  },
};

// Toutes les images sont pré-optimisées en WebP responsive (script
// scripts/optimize-concours.mjs). Le poster de la vidéo (portrait-md)
// pèse ~40 KB : essentiel pour le LCP.
const PORTRAIT_MD = "/uploads/concours/portrait-mickael-md.webp";
const SAFARI = "/uploads/concours/safari-tanzanie.webp";
const ZANZIBAR = "/uploads/concours/maries-zanzibar.webp";
const LOGO_PARTNER = "/uploads/concours/logo-sansanlaclak.webp";
// Vidéo compressée H.264 720p CRF 28 (~4,4 MB, +faststart), servie
// depuis le même origin pour bénéficier du CDN edge Vercel.
const VIDEO_URL = "/uploads/concours/video-concours.mp4";

const formules = [
  { num: 1, title: "L’Essentielle", participations: 1, hint: "Reportage cœur de journée" },
  { num: 2, title: "Le Grand Jour", participations: 2, hint: "Reportage journée complète" },
  { num: 3, title: "Le Grand Classique", participations: 3, hint: "Journée complète + préparatifs" },
  { num: 4, title: "Prestige Éternel", participations: 5, hint: "Reportage intégral + album fine art" },
];

const timeline = [
  {
    eyebrow: "01 · Salon du mariage de Nice",
    title: "Venez me rencontrer",
    body: "Je serai présent au Salon du Mariage de Nice au début du mois de novembre. Ce sera l’occasion de découvrir mon travail et d’échanger sur votre projet.",
  },
  {
    eyebrow: "02 · Clôture des participations",
    title: "Le 23 décembre 2027 à 23 h 59",
    body: "Toutes les réservations effectuées avant cette date-limite seront automatiquement inscrites au tirage au sort.",
  },
  {
    eyebrow: "03 · Tirage & annonce",
    title: "Le 24 décembre à 20 h",
    body: "Tirage officiel sous caméra le 23 décembre pour la transparence. Vidéo publiée le 24 décembre à 20 h — la magie de Noël, un cadeau inoubliable.",
  },
];

export default async function ConcoursPage() {
  const lang = getLangFromCookies();

  return (
    <main>
      <PageSections page="concours" slot="top" lang={lang} />

      {/* ─────────────────────────── HERO ─────────────────────────── */}
      <section
        className="concours-hero-section"
        style={{
          position: "relative",
          background: "linear-gradient(180deg, var(--cream) 0%, var(--cream-deep) 100%)",
          padding: "90px 0 110px",
          overflow: "hidden",
        }}
      >
        <div aria-hidden className="concours-hero-decor" style={{ position: "absolute", top: -160, right: -160, width: 460, height: 460, border: "1px solid rgba(184, 151, 90, 0.25)", borderRadius: "50%", pointerEvents: "none" }} />
        <div aria-hidden className="concours-hero-decor" style={{ position: "absolute", bottom: -220, left: -220, width: 520, height: 520, border: "1px solid rgba(184, 151, 90, 0.18)", borderRadius: "50%", pointerEvents: "none" }} />

        <div className="container-wide" style={{ position: "relative" }}>
          <div className="concours-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 60, alignItems: "center" }}>
            {/* Colonne texte */}
            <Rise>
              <div>
                <div className="cap-tracked gold" style={{ marginBottom: 22 }}>
                  UN CADEAU DE NOËL EXCEPTIONNEL
                </div>
                <h1 className="serif concours-hero-title" style={{ fontSize: "clamp(48px, 6.5vw, 88px)", lineHeight: 1.02, color: "var(--forest)", fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
                  Le grand
                  <br />
                  <span style={{ fontStyle: "italic", color: "var(--gold)" }}>concours</span>
                </h1>
                <div style={{ marginTop: 26, marginBottom: 30 }}>
                  <OrnamentDivider width={72} />
                </div>
                <p style={{ fontSize: 20, lineHeight: 1.55, color: "var(--forest)", maxWidth: 520, margin: 0 }}>
                  Réservez votre mariage en{" "}
                  <span className="serif" style={{ fontStyle: "italic", color: "var(--gold-deep)", fontSize: 22 }}>2027</span>{" "}
                  ou{" "}
                  <span className="serif" style={{ fontStyle: "italic", color: "var(--gold-deep)", fontSize: 22 }}>2028</span>{" "}
                  et tentez de gagner un <em>safari en Tanzanie</em> et deux nuits à Zanzibar.
                </p>
                <p style={{ fontSize: 15.5, lineHeight: 1.75, color: "var(--muted)", maxWidth: 520, marginTop: 18 }}>
                  Parce qu’un mariage est une aventure unique, j’ai souhaité remercier les couples qui me feront confiance avec une expérience tout aussi inoubliable — un voyage que j’ai moi-même eu la chance de vivre.
                </p>
                <div className="concours-hero-buttons" style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
                  <Link href="#formules" className="btn btn-forest" style={{ fontSize: 11 }}>
                    JE VEUX PARTICIPER
                  </Link>
                  <Link href="#gagner" className="btn btn-sage" style={{ fontSize: 11 }}>
                    DÉCOUVRIR LE PRIX
                  </Link>
                </div>
              </div>
            </Rise>

            {/* Colonne vidéo + portrait */}
            <Rise delay={140}>
              <div className="concours-hero-video-frame" style={{ position: "relative", aspectRatio: "9 / 16", maxWidth: 420, marginLeft: "auto", background: "#000" }}>
                {/* cadre doré */}
                <div aria-hidden style={{ position: "absolute", inset: -18, border: "1px solid var(--gold)", opacity: 0.55, pointerEvents: "none", zIndex: 2 }} />
                <ConcoursVideo
                  src={VIDEO_URL}
                  posterSrc={PORTRAIT_MD}
                  posterAlt="Mickael Romero — photographe de mariage"
                  posterWidth={900}
                  posterHeight={1600}
                />
                {/* badge */}
                <div className="concours-hero-edition-badge" style={{ position: "absolute", bottom: -32, left: -32, background: "var(--forest)", color: "#F4EFE3", padding: "18px 22px", textAlign: "center", boxShadow: "0 12px 30px rgba(46, 61, 46, 0.28)", zIndex: 3 }}>
                  <div className="serif" style={{ fontStyle: "italic", fontSize: 15, color: "var(--gold-light)" }}>Édition</div>
                  <div className="serif" style={{ fontSize: 34, lineHeight: 1, marginTop: 4 }}>2026</div>
                </div>
              </div>
            </Rise>
          </div>
        </div>
      </section>

      {/* ─────────────── AVANT TOUTE CHOSE (intro personnelle) ─────────────── */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 860 }}>
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
            <div style={{ marginTop: 40, fontSize: 17, lineHeight: 1.85, color: "var(--ink)" }}>
              <p style={{ marginBottom: 22 }}>
                Il me paraît essentiel de préciser une chose. Je souhaite avant tout que vous choisissiez votre
                photographe pour la qualité de son travail, son univers et les émotions qu’il vous transmet.
              </p>
              <p style={{ marginBottom: 22 }}>
                Ce concours n’a jamais eu pour objectif de vous convaincre de réserver une prestation si mon style ne
                vous correspond pas.
              </p>
              <p style={{ marginBottom: 22 }}>
                En revanche, si vous aimez mon approche photographique, que mes prestations correspondent à vos attentes
                et que votre budget vous permet de faire appel à moi, alors je serai sincèrement heureux de pouvoir
                remercier l’un de mes couples en lui offrant ce voyage exceptionnel.
              </p>
              <p style={{ fontStyle: "italic", color: "var(--gold-deep)", fontSize: 20, textAlign: "center", marginTop: 34 }}>
                « C’est simplement ma manière de rendre un peu de tout ce que mes mariés m’apportent chaque saison. »
              </p>
            </div>
          </Rise>
        </div>
      </section>

      {/* ─────────────────────── FORMULES ─────────────────────── */}
      <section id="formules" className="section-pad" style={{ background: "var(--cream-deep)" }}>
        <div className="container-wide">
          <Rise>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div className="cap-tracked gold">COMMENT PARTICIPER</div>
              <h2 className="h-section" style={{ marginTop: 14 }}>
                Chaque réservation ouvre <span style={{ fontStyle: "italic", color: "var(--gold)" }}>des chances</span>
              </h2>
              <OrnamentDivider />
              <p style={{ maxWidth: 640, margin: "26px auto 0", color: "var(--muted)", fontSize: 15.5, lineHeight: 1.75 }}>
                Le principe est très simple : chaque réservation d’un mariage pour la saison <b>2027</b> ou <b>2028</b>{" "}
                donne automatiquement accès au concours. Le nombre de participations dépend simplement de la formule
                choisie — <em>aucune démarche supplémentaire, tout est enregistré à la signature</em>.
              </p>
            </div>
          </Rise>

          <div className="concours-formules-grid" style={{ marginTop: 50 }}>
            {formules.map((f, i) => (
              <Rise key={f.num} delay={i * 90}>
                <article className="concours-card" style={{ background: "#FFFFFF", border: "1px solid var(--rule)", padding: "36px 26px 34px", textAlign: "center", position: "relative", height: "100%", boxSizing: "border-box", transition: "transform 220ms ease, box-shadow 220ms ease, border-color 220ms" }}>
                  <div className="cap-tracked" style={{ color: "var(--muted)", fontSize: 10 }}>
                    FORMULE 0{f.num}
                  </div>
                  <div className="serif" style={{ fontSize: 24, color: "var(--forest)", marginTop: 12, fontStyle: "italic" }}>
                    {f.title}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "28px 0 18px" }}>
                    <div className="concours-card-circle" style={{ width: 88, height: 88, borderRadius: "50%", border: "1px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      <div aria-hidden style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "1px solid var(--gold)", opacity: 0.4 }} />
                      <span className="serif concours-card-number" style={{ fontStyle: "italic", fontSize: 48, color: "var(--gold-deep)", lineHeight: 1 }}>
                        {f.participations}
                      </span>
                    </div>
                  </div>
                  <div className="cap-tracked-sm" style={{ color: "var(--gold-deep)", fontSize: 10, marginBottom: 12 }}>
                    {f.participations > 1 ? "PARTICIPATIONS" : "PARTICIPATION"}
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{f.hint}</p>
                </article>
              </Rise>
            ))}
          </div>

          <Rise delay={400}>
            <div className="concours-info" style={{ marginTop: 60, background: "linear-gradient(135deg, rgba(184, 151, 90, 0.10), rgba(184, 151, 90, 0.03))", border: "1px solid rgba(184, 151, 90, 0.35)", padding: "28px 34px", display: "flex", gap: 24, alignItems: "center", maxWidth: 920, marginLeft: "auto", marginRight: "auto" }}>
              <div aria-hidden style={{ flexShrink: 0, width: 56, height: 56, borderRadius: "50%", background: "var(--gold)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                ✦
              </div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: "var(--ink)" }}>
                <strong style={{ color: "var(--forest)" }}>Pourquoi plusieurs participations&nbsp;?</strong> Chaque
                formule représente un investissement, un temps de présence et une préparation différents. Il m’a semblé
                naturel que les prestations les plus complètes offrent davantage de chances lors du tirage — une façon
                de remercier les couples qui me confient la couverture la plus complète de leur journée.
              </p>
            </div>
          </Rise>
        </div>
      </section>

      {/* ─────────────────────── TIMELINE ─────────────────────── */}
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
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, background: "var(--cream)" }}>
                    <StepNumber n={i + 1} />
                  </div>
                  <div className="cap-tracked" style={{ color: "var(--gold)", fontSize: 11, marginBottom: 10 }}>
                    {t.eyebrow}
                  </div>
                  <div className="serif" style={{ fontSize: 22, color: "var(--forest)", fontStyle: "italic", marginBottom: 12 }}>
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
      <section id="gagner" style={{ background: "var(--forest)", color: "#E5E1D8", padding: "110px 0 120px", position: "relative", overflow: "hidden" }}>
        <div className="container-wide">
          <Rise>
            <div style={{ textAlign: "center", marginBottom: 70 }}>
              <div className="cap-tracked" style={{ color: "var(--gold-light)" }}>À GAGNER</div>
              <h2 className="serif" style={{ fontSize: "clamp(38px, 4.5vw, 58px)", lineHeight: 1.1, color: "#F4EFE3", fontWeight: 400, marginTop: 14 }}>
                Un voyage <span style={{ fontStyle: "italic", color: "var(--gold-light)" }}>d’exception</span>
              </h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 22 }}>
                <span style={{ display: "inline-block", width: 60, height: 1, background: "var(--gold)", opacity: 0.55 }} />
                <span style={{ display: "inline-block", width: 6, height: 6, background: "var(--gold)", transform: "rotate(45deg)", margin: "0 12px" }} />
                <span style={{ display: "inline-block", width: 60, height: 1, background: "var(--gold)", opacity: 0.55 }} />
              </div>
              <p style={{ maxWidth: 640, margin: "26px auto 0", color: "#C9C2B4", fontSize: 15.5, lineHeight: 1.75 }}>
                Une aventure unique au cœur de l’Afrique — entre les plus grands parcs animaliers du monde et les
                plages paradisiaques de Zanzibar.
              </p>
            </div>
          </Rise>

          <div className="concours-prize-grid">
            <Rise>
              <div style={{ position: "relative" }}>
                <div style={{ overflow: "hidden", aspectRatio: "4 / 5", position: "relative" }}>
                  <Image
                    src={SAFARI}
                    alt="Safari en Tanzanie au coucher du soleil"
                    fill
                    sizes="(max-width: 900px) 100vw, 640px"
                    style={{ objectFit: "cover", objectPosition: "center" }}
                  />
                </div>
                <div style={{ marginTop: 28, textAlign: "center" }}>
                  <div className="cap-tracked" style={{ color: "var(--gold-light)", fontSize: 11 }}>ÉTAPE 01 · 🏕️</div>
                  <div className="serif" style={{ fontSize: 30, color: "#F4EFE3", fontStyle: "italic", marginTop: 10 }}>
                    Safari en Tanzanie
                  </div>
                  <p style={{ color: "#C9C2B4", fontSize: 14, lineHeight: 1.7, marginTop: 14, maxWidth: 380, margin: "14px auto 0" }}>
                    Big Five, savane à perte de vue, coucher de soleil sur le Serengeti — une aventure d’exception dans
                    les plus grands parcs animaliers du monde.
                  </p>
                </div>
              </div>
            </Rise>

            <Rise delay={140}>
              <div style={{ position: "relative" }}>
                <div style={{ overflow: "hidden", aspectRatio: "4 / 5", position: "relative" }}>
                  <Image
                    src={ZANZIBAR}
                    alt="Couple de mariés sur une plage de Zanzibar"
                    fill
                    sizes="(max-width: 900px) 100vw, 640px"
                    style={{ objectFit: "cover", objectPosition: "center" }}
                  />
                </div>
                <div style={{ marginTop: 28, textAlign: "center" }}>
                  <div className="cap-tracked" style={{ color: "var(--gold-light)", fontSize: 11 }}>ÉTAPE 02 · 🏝️</div>
                  <div className="serif" style={{ fontSize: 30, color: "#F4EFE3", fontStyle: "italic", marginTop: 10 }}>
                    Deux nuits à Zanzibar
                  </div>
                  <p style={{ color: "#C9C2B4", fontSize: 14, lineHeight: 1.7, marginTop: 14, maxWidth: 380, margin: "14px auto 0" }}>
                    Sable blanc, eau turquoise, hôtel de charme — deux nuits pour se poser, savourer et prolonger le
                    rêve après le safari.
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
            <div className="concours-partner" style={{ background: "#FFFFFF", border: "1px solid var(--rule)", padding: "44px 46px", display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 auto", textAlign: "center" }}>
                <div className="concours-partner-logo" style={{ width: 160, height: 160, borderRadius: "50%", overflow: "hidden", border: "1px solid var(--gold)", margin: "0 auto", boxShadow: "0 8px 22px rgba(184, 151, 90, 0.20)", position: "relative" }}>
                  <Image
                    src={LOGO_PARTNER}
                    alt="Logo SansanLaclak Travel"
                    fill
                    sizes="160px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className="cap-tracked-sm gold" style={{ marginTop: 16 }}>NOTRE PARTENAIRE</div>
                <div className="serif" style={{ fontSize: 22, color: "var(--forest)", marginTop: 6, fontStyle: "italic" }}>
                  SansanLaclak Travel
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, letterSpacing: "0.14em" }}>
                  AGENCE DE SAFARI EN TANZANIE
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.8, color: "var(--ink)" }}>
                  Pour ce concours, j’ai choisi de collaborer avec <b>SansanLaclak Travel</b>, une agence spécialisée
                  dans les safaris en Tanzanie. J’ai eu la chance de vivre cette aventure avec eux lors d’un voyage
                  photographique professionnel, et cela reste l’une des plus belles expériences de ma vie.
                </p>
                <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.8, color: "var(--muted)" }}>
                  Grâce à eux, j’ai pu observer le Big Five, vivre des moments incroyables au plus près de la nature et
                  découvrir une culture d’une richesse exceptionnelle.
                </p>
                <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.8, color: "var(--muted)", fontStyle: "italic" }}>
                  C’est donc tout naturellement que j’ai souhaité leur faire confiance pour organiser le voyage du couple
                  gagnant — je les remercie sincèrement d’avoir accepté de m’accompagner dans cette belle aventure.
                </p>
              </div>
            </div>
          </Rise>
        </div>
      </section>

      {/* ─────────────────────── UNE DERNIÈRE CHOSE ─────────────────────── */}
      <section className="section-pad" style={{ background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 780, textAlign: "center" }}>
          <Rise>
            <div className="cap-tracked gold">UNE DERNIÈRE CHOSE</div>
            <h2 className="h-section" style={{ marginTop: 14 }}>
              Ajouter simplement une <span style={{ fontStyle: "italic", color: "var(--gold)" }}>belle dose de rêve</span>
            </h2>
            <OrnamentDivider />
            <p style={{ marginTop: 34, fontSize: 17, lineHeight: 1.85, color: "var(--ink)" }}>
              Si mon univers vous touche, que mes images racontent l’histoire que vous imaginez pour votre mariage et que
              vous envisagez déjà de me confier cette journée si précieuse, alors j’espère que ce concours ajoutera
              simplement une belle dose de rêve à cette aventure.
            </p>
            <p style={{ marginTop: 22, fontSize: 18, lineHeight: 1.7, color: "var(--gold-deep)", fontStyle: "italic" }}>
              Au plaisir de raconter votre histoire… et peut-être de vous envoyer vivre l’un des plus beaux voyages de
              votre vie.
            </p>
          </Rise>
        </div>
      </section>

      {/* ─────────────────────── CTA FINAL ─────────────────────── */}
      <section style={{ background: "var(--sage-soft)", padding: "80px 0", borderTop: "1px solid var(--rule)" }}>
        <div className="container" style={{ textAlign: "center", maxWidth: 720 }}>
          <Rise>
            <div className="cap-tracked gold" style={{ marginBottom: 14 }}>PRÊT À TENTER VOTRE CHANCE ?</div>
            <div className="serif" style={{ fontSize: "clamp(28px, 3.4vw, 36px)", color: "var(--forest)", lineHeight: 1.3, marginBottom: 32 }}>
              Si mon univers vous parle,
              <br />
              <span style={{ fontStyle: "italic", color: "var(--gold)" }}>je serai honoré de raconter votre jour.</span>
            </div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link className="btn btn-forest" href="/prestations">DÉCOUVRIR MES PRESTATIONS</Link>
              <Link className="btn btn-sage" href="/contact">PARLONS DE VOTRE PROJET</Link>
            </div>
          </Rise>
        </div>
      </section>

      <PageSections page="concours" slot="bottom" lang={lang} />

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

        /* ── Tablette (< 900px) ── */
        @media (max-width: 900px) {
          .concours-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 60px !important;
          }
          .concours-hero-video-frame { max-width: 360px !important; margin: 0 auto !important; }
          .concours-formules-grid { grid-template-columns: repeat(2, 1fr); gap: 18px; }
          .concours-timeline { grid-template-columns: 1fr; gap: 48px; }
          .concours-timeline__line { display: none; }
          .concours-prize-grid { grid-template-columns: 1fr; gap: 56px; }
          .concours-partner { padding: 32px 24px !important; gap: 26px !important; }
          .concours-info { flex-direction: column; text-align: center; padding: 24px 22px !important; gap: 16px !important; }
          .concours-hero-section { padding: 60px 0 80px !important; }
          .concours-hero-decor { display: none !important; }
        }

        /* ── Mobile (< 600px) ── */
        @media (max-width: 600px) {
          .concours-hero-section { padding: 40px 0 60px !important; }
          .concours-hero-video-frame {
            max-width: 100% !important;
            aspect-ratio: 3 / 4 !important;
          }
          .concours-hero-edition-badge {
            bottom: -18px !important;
            left: 50% !important;
            transform: translateX(-50%);
            padding: 12px 22px !important;
          }
          .concours-hero-edition-badge > div:first-child { font-size: 13px !important; }
          .concours-hero-edition-badge > div:last-child { font-size: 26px !important; }
          .concours-hero-buttons { flex-direction: column; align-items: stretch; gap: 10px !important; }
          .concours-hero-buttons > a { width: 100%; text-align: center; }
          .concours-formules-grid { grid-template-columns: 1fr; gap: 16px; }
          .concours-card { padding: 30px 22px 28px !important; }
          .concours-card-circle { width: 72px !important; height: 72px !important; }
          .concours-card-number { font-size: 40px !important; }
          .concours-partner-logo { width: 130px !important; height: 130px !important; }
          .concours-section-pad-mobile { padding: 56px 0 !important; }
        }

        /* ── Petit mobile (< 380px) ── */
        @media (max-width: 380px) {
          .concours-hero-title { font-size: 42px !important; }
          .concours-hero-buttons > a { font-size: 10.5px !important; padding: 12px 16px !important; }
        }
      `}</style>
    </main>
  );
}
