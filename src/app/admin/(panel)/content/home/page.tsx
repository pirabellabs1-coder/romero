import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import { listGalleries, coverFor, pickShowcasePhotos, photoUrl } from "@/lib/content";
import { listSectionsForPage } from "@/lib/page-sections";
import HomeContentEditor from "@/components/admin/HomeContentEditor";
import SectionsEditor from "@/components/admin/SectionsEditor";
import { saveContentFields, saveContentPhoto, saveContentPhotoFocal } from "../actions";
import { setGalleryFeatured } from "../../galleries/actions";
import {
  addSectionAction,
  updateSectionAction,
  deleteSectionAction,
  moveSectionAction,
  changeSectionSlotAction,
} from "../sections-actions";

export const dynamic = "force-dynamic";

const DEFAULT_HERO = "/uploads/hero.jpg";

// Flatten the home strings (including the `values` array) into a flat
// Record<key, value> for both languages, so the editor can do a uniform
// key-by-key comparison against overrides.
function flatHomeDefaults(lang: "fr" | "en"): Record<string, string> {
  const home = STRINGS[lang].home as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(home)) {
    if (typeof v === "string") out[k] = v;
  }
  const values = home.values as unknown as Array<[string, string]>;
  values?.forEach(([t, b], i) => {
    out[`values_${i}_title`] = t;
    out[`values_${i}_body`] = b;
  });
  // Teaser block defaults inherit from the Services page strings + nav label.
  const nav = STRINGS[lang].nav;
  const services = STRINGS[lang].services;
  out["teaser_eyebrow"]     = nav.services;
  out["teaser_title"]       = services.title;
  out["teaser_titleAccent"] = services.titleAccent;
  out["teaser_lead"]        = services.lead;
  out["teaser_cta"]         = services.cta;
  return out;
}

async function toggleFeatured(galleryId: number, featured: boolean) { "use server"; return setGalleryFeatured(galleryId, featured); }
async function saveHero(url: string)         { "use server"; return saveContentPhoto("home", "hero_photo", url); }
async function saveHeroFocal(f: string)      { "use server"; return saveContentPhotoFocal("home", "hero_photo", f); }
async function saveTeaserPhoto0(url: string) { "use server"; return saveContentPhoto("home", "teaser_photo_0", url); }
async function saveTeaserPhoto1(url: string) { "use server"; return saveContentPhoto("home", "teaser_photo_1", url); }
async function saveTeaserPhoto2(url: string) { "use server"; return saveContentPhoto("home", "teaser_photo_2", url); }
async function saveTeaserPhoto3(url: string) { "use server"; return saveContentPhoto("home", "teaser_photo_3", url); }
async function saveTeaserFocal0(f: string)   { "use server"; return saveContentPhotoFocal("home", "teaser_photo_0", f); }
async function saveTeaserFocal1(f: string)   { "use server"; return saveContentPhotoFocal("home", "teaser_photo_1", f); }
async function saveTeaserFocal2(f: string)   { "use server"; return saveContentPhotoFocal("home", "teaser_photo_2", f); }
async function saveTeaserFocal3(f: string)   { "use server"; return saveContentPhotoFocal("home", "teaser_photo_3", f); }

export default async function HomeContentPage() {
  const [overrides, allGals, sections, teaserPool] = await Promise.all([
    getPageContentBilingual("home"),
    listGalleries(),
    listSectionsForPage("home"),
    pickShowcasePhotos(4, "home-teaser-v1"),
  ]);
  // On envoie TOUTES les galeries publiées, pas seulement celles déjà en
  // avant : le bloc « à la une » doit permettre de cocher/décocher sur place,
  // sinon il n'y a rien à modifier quand aucune galerie n'est marquée.
  const allCovers = await Promise.all(
    allGals.map((g) => coverFor(g, `home-featured-${g.slug}`))
  );
  const galleries = allGals.map((g, i) => ({
    id: g.id,
    slug: g.slug,
    names: g.names,
    place: g.place,
    coverUrl: allCovers[i],
    coverPosition: g.cover_position || "center center",
    featured: !!g.featured,
  }));

  const heroPhoto = overrides.fr["hero_photo"] || DEFAULT_HERO;
  const heroPhotoFocal = overrides.fr["hero_photo_focal"] || "center center";

  // Teaser photos: admin URL wins, else fallback to the random pool.
  const teaserPhotos: [string, string, string, string] = [
    overrides.fr["teaser_photo_0"] || photoUrl(teaserPool[0]) || DEFAULT_HERO,
    overrides.fr["teaser_photo_1"] || photoUrl(teaserPool[1]) || DEFAULT_HERO,
    overrides.fr["teaser_photo_2"] || photoUrl(teaserPool[2]) || DEFAULT_HERO,
    overrides.fr["teaser_photo_3"] || photoUrl(teaserPool[3]) || DEFAULT_HERO,
  ];
  const teaserFocals: [string, string, string, string] = [
    overrides.fr["teaser_photo_0_focal"] || "center center",
    overrides.fr["teaser_photo_1_focal"] || "center center",
    overrides.fr["teaser_photo_2_focal"] || "center center",
    overrides.fr["teaser_photo_3_focal"] || "center center",
  ];

  // Drop photo URL/focal keys from the text editor (they're not strings).
  const NON_TEXT_KEYS = new Set([
    "hero_photo", "hero_photo_focal",
    "teaser_photo_0", "teaser_photo_0_focal",
    "teaser_photo_1", "teaser_photo_1_focal",
    "teaser_photo_2", "teaser_photo_2_focal",
    "teaser_photo_3", "teaser_photo_3_focal",
  ]);
  const frTexts: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides.fr)) if (!NON_TEXT_KEYS.has(k)) frTexts[k] = v;
  const enTexts: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides.en)) if (!NON_TEXT_KEYS.has(k)) enTexts[k] = v;

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Accueil</h1>
      <p className="admin-sub">
        Modifiez chaque texte et photo dans l&apos;ordre d&apos;apparition. Switchez entre FR et EN avec les boutons en haut.
      </p>

      <HomeContentEditor
        initialFr={frTexts}
        initialEn={enTexts}
        defaultsFr={flatHomeDefaults("fr")}
        defaultsEn={flatHomeDefaults("en")}
        galleries={galleries}
        setFeaturedAction={toggleFeatured}
        heroPhoto={heroPhoto}
        heroPhotoFocal={heroPhotoFocal}
        teaserPhotos={teaserPhotos}
        teaserFocals={teaserFocals}
        saveAction={saveContentFields}
        saveHeroAction={saveHero}
        saveHeroFocalAction={saveHeroFocal}
        saveTeaserPhoto0={saveTeaserPhoto0}
        saveTeaserPhoto1={saveTeaserPhoto1}
        saveTeaserPhoto2={saveTeaserPhoto2}
        saveTeaserPhoto3={saveTeaserPhoto3}
        saveTeaserFocal0={saveTeaserFocal0}
        saveTeaserFocal1={saveTeaserFocal1}
        saveTeaserFocal2={saveTeaserFocal2}
        saveTeaserFocal3={saveTeaserFocal3}
      />

      {/* ── Sections custom (modular blocks à la Elementor light) ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>⑥ Sections personnalisées</h2>
          <p>Ajoutez autant de sections que vous voulez à la fin de la page. Texte, image+texte, citation, photo pleine largeur.</p>
        </div>
        <SectionsEditor
          page="home"
          initialSections={sections}
          addAction={addSectionAction}
          updateAction={updateSectionAction}
          deleteAction={deleteSectionAction}
          moveAction={moveSectionAction}
          changeSlotAction={changeSectionSlotAction}
        />
      </div>
    </>
  );
}
