import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import { listGalleries, coverFor } from "@/lib/content";
import ContentField from "@/components/admin/ContentField";
import HeroPhotoUploader from "@/components/admin/HeroPhotoUploader";
import { saveContentField, saveContentPhoto } from "../actions";

export const dynamic = "force-dynamic";

// Default hardcoded hero — used until the admin replaces it.
const DEFAULT_HERO = "/uploads/hero.jpg";

function defaultStr(key: string): string {
  const home = STRINGS.fr.home as unknown as Record<string, unknown>;
  const arr = key.match(/^values_(\d+)_(title|body)$/);
  if (arr) {
    const i = Number(arr[1]);
    const slot = arr[2] === "title" ? 0 : 1;
    const v = (home.values as unknown as Array<[string, string]>)[i];
    return v?.[slot] ?? "";
  }
  const raw = home[key];
  return typeof raw === "string" ? raw : "";
}
function defaultEn(key: string): string {
  const home = STRINGS.en.home as unknown as Record<string, unknown>;
  const arr = key.match(/^values_(\d+)_(title|body)$/);
  if (arr) {
    const i = Number(arr[1]);
    const slot = arr[2] === "title" ? 0 : 1;
    const v = (home.values as unknown as Array<[string, string]>)[i];
    return v?.[slot] ?? "";
  }
  const raw = home[key];
  return typeof raw === "string" ? raw : "";
}

// Bound versions of the photo save action, one per key the home uses.
async function saveHeroPhoto(url: string) {
  "use server";
  return saveContentPhoto("home", "hero_photo", url);
}

export default async function HomeContentEditor() {
  const overrides = await getPageContentBilingual("home");
  const featuredGals = (await listGalleries({ featuredOnly: true })).slice(0, 3);
  const featuredCovers = await Promise.all(
    featuredGals.map((g) => coverFor(g, `home-featured-${g.slug}`))
  );

  const heroPhotoUrl = overrides.fr["hero_photo"] || DEFAULT_HERO;

  const field = (
    key: string,
    label: string,
    opts?: { variant?: "input" | "textarea"; hint?: string }
  ) => (
    <ContentField
      page="home"
      fieldKey={key}
      label={label}
      variant={opts?.variant}
      hint={opts?.hint}
      initialFr={overrides.fr[key] ?? ""}
      initialEn={overrides.en[key] ?? ""}
      defaultFr={defaultStr(key)}
      defaultEn={defaultEn(key)}
      saveAction={saveContentField}
      showEn={false}
    />
  );

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
        <div>
          <h1 className="admin-h1" style={{ margin: 0 }}>Page Accueil</h1>
          <p className="admin-sub" style={{ marginTop: 4 }}>
            Modifiez chaque texte et photo dans l&apos;ordre exact d&apos;apparition sur la page. Les changements sont enregistrés à chaud.
          </p>
        </div>
        <Link href="/" target="_blank" className="admin-btn ghost" style={{ fontSize: 11 }}>
          VOIR LA PAGE ↗
        </Link>
      </div>

      <div className="admin-flash" style={{ background: "rgba(184,151,90,.08)", borderColor: "var(--gold)", color: "var(--gold-deep)", marginBottom: 14 }}>
        🇫🇷 Vous éditez la version française. La version anglaise sera ajoutée par la suite — les visiteurs anglophones voient pour l&apos;instant les textes par défaut.
      </div>

      {/* ─── SECTION 1: HERO ────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>① Bandeau d&apos;accueil</h2>
          <p>La toute première chose que voient les visiteurs.</p>
        </div>

        <div className="content-layout-hero">
          <div className="content-layout-hero__text">
            {field("eyebrow", "Phrase de surtitre", { hint: "Petite phrase au-dessus du titre, en petites majuscules dorées." })}
            {field("title1", "Titre — première ligne")}
            {field("title2", "Titre — deuxième ligne (italique doré)")}
            {field("sub", "Sous-titre / paragraphe d'introduction", { variant: "textarea" })}
            {field("cta", "Bouton principal (sauge)")}
            {field("locale", "Ligne du bas (« Nice — Côte d'Azur — Worldwide »)")}
          </div>
          <div className="content-layout-hero__photo">
            <HeroPhotoUploader
              currentUrl={heroPhotoUrl}
              caption="Photo affichée à droite du titre. Format vertical recommandé (3:4 ou 4:5)."
              ratio="3 / 4"
              saveAction={saveHeroPhoto}
            />
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: VALUES BAND ─────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>② Bande des valeurs</h2>
          <p>Les quatre piliers qui définissent votre signature, sur fond crème.</p>
        </div>

        {field("valuesEyebrow", "Surtitre")}
        {field("valuesTitle", "Titre de la section")}

        <div className="content-values-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="content-values-cell">
              <div className="content-values-cell__head">Valeur {i + 1}</div>
              {field(`values_${i}_title`, "Titre")}
              {field(`values_${i}_body`, "Texte", { variant: "textarea" })}
            </div>
          ))}
        </div>
      </div>

      {/* ─── SECTION 3: FEATURED ───────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>③ Mariages à la une</h2>
          <p>
            Les trois galeries marquées <em>« Mise en avant »</em> dans Galeries.{" "}
            <Link href="/admin/galleries" className="gold" style={{ textDecoration: "underline" }}>
              Gérer les galeries en avant
            </Link>
          </p>
        </div>

        {field("featuredEyebrow", "Surtitre (small caps)")}
        {field("featuredTitle", "Titre de section")}
        {field("featuredCta", "Bouton « Tout le portfolio »")}

        <div className="content-featured-row">
          {featuredGals.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Aucune galerie n&apos;est marquée « mise en avant ».</p>
          ) : (
            featuredGals.map((g, i) => (
              <div key={g.id} className="content-featured-card">
                <div className="content-featured-card__photo">
                  {featuredCovers[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featuredCovers[i]} alt={g.names} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.cover_position || "center center" }} />
                  )}
                </div>
                <div className="content-featured-card__title serif">{g.names}</div>
                <div className="content-featured-card__sub">{g.place}</div>
                <Link href={`/admin/galleries/${g.id}`} className="cap-tracked-sm gold" style={{ fontSize: 10 }}>
                  MODIFIER ↗
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── SECTION 4: QUOTE BAND ─────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>④ Bande citation</h2>
          <p>Le bandeau sauge avec le monogramme et une citation au milieu.</p>
        </div>

        {field("bandQuote", "Citation (italique)", { variant: "textarea" })}
        {field("bandAttr", "Attribution (« — Mickael Romero »)")}
      </div>
    </>
  );
}
