import Link from "next/link";
import { getPageContentBilingual, getPageContent } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import { pickShowcasePhotos, photoUrl } from "@/lib/content";
import { listSectionsForPage } from "@/lib/page-sections";
import { PAGE_SLOTS } from "@/lib/page-slots";
import AboutContentEditor from "@/components/admin/AboutContentEditor";
import SectionsEditor from "@/components/admin/SectionsEditor";
import { saveContentFields, saveContentPhoto, saveContentPhotoFocal } from "../actions";
import {
  addSectionAction, updateSectionAction, deleteSectionAction,
  moveSectionAction, changeSectionSlotAction,
} from "../sections-actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

function flatAboutDefaults(lang: "fr" | "en"): Record<string, string> {
  const about = STRINGS[lang].about as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(about)) {
    if (typeof v === "string") out[k] = v;
  }
  (about.body as string[] | undefined)?.forEach((p, i) => { out[`body_${i}`] = p; });
  (about.values as Array<[string, string]> | undefined)?.forEach(([t, b], i) => {
    out[`values_${i}_title`] = t; out[`values_${i}_body`] = b;
  });
  (about.process as Array<[string, string]> | undefined)?.forEach(([t, b], i) => {
    out[`process_${i}_title`] = t; out[`process_${i}_body`] = b;
  });
  (about.gear as string[] | undefined)?.forEach((g, i) => { out[`gear_${i}`] = g; });
  // CTA block at the end of the page (shared default strings).
  const cta = STRINGS[lang].cta as { question: string; line1: string; line2: string };
  out["cta_question"] = cta.question;
  out["cta_line1"] = cta.line1;
  out["cta_line2"] = cta.line2;
  return out;
}

async function saveAboutEyebrowPhoto(url: string) {
  "use server";
  return saveContentPhoto("about", "photo_eyebrow", url);
}
async function saveAboutStoryPhoto(url: string) {
  "use server";
  return saveContentPhoto("about", "photo_story", url);
}
async function saveAboutEyebrowFocal(focal: string) {
  "use server";
  return saveContentPhotoFocal("about", "photo_eyebrow", focal);
}
async function saveAboutStoryFocal(focal: string) {
  "use server";
  return saveContentPhotoFocal("about", "photo_story", focal);
}

export default async function AboutContentPage() {
  cmsPageGuard("about");
  const [overrides, fallbackPool, frOnly, sections] = await Promise.all([
    getPageContentBilingual("about"),
    pickShowcasePhotos(2, "about-v1"),
    getPageContent("about", "fr"),
    listSectionsForPage("about"),
  ]);
  const slotCfg = PAGE_SLOTS["about"];
  const eyebrowPhotoUrl   = frOnly["photo_eyebrow"]       || photoUrl(fallbackPool[0]) || "/uploads/hero.jpg";
  const storyPhotoUrl     = frOnly["photo_story"]         || photoUrl(fallbackPool[1]) || "/uploads/hero.jpg";
  const eyebrowPhotoFocal = frOnly["photo_eyebrow_focal"] || "center center";
  const storyPhotoFocal   = frOnly["photo_story_focal"]   || "center center";

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page À propos</h1>
      <p className="admin-sub">Chaque bloc reproduit exactement la structure de la page publique — photos et textes à leurs positions réelles.</p>

      <AboutContentEditor
        initialFr={overrides.fr}
        initialEn={overrides.en}
        defaultsFr={flatAboutDefaults("fr")}
        defaultsEn={flatAboutDefaults("en")}
        eyebrowPhotoUrl={eyebrowPhotoUrl}
        eyebrowPhotoFocal={eyebrowPhotoFocal}
        storyPhotoUrl={storyPhotoUrl}
        storyPhotoFocal={storyPhotoFocal}
        saveAction={saveContentFields}
        saveEyebrowPhotoAction={saveAboutEyebrowPhoto}
        saveEyebrowFocalAction={saveAboutEyebrowFocal}
        saveStoryPhotoAction={saveAboutStoryPhoto}
        saveStoryFocalAction={saveAboutStoryFocal}
      />

      {/* ─── Sections personnalisées (Elementor-light) ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>➕ Sections personnalisées</h2>
          <p>Ajoutez vos propres sections en haut ou en bas de la page (texte, image+texte, citation, bandeau image).</p>
        </div>
        <SectionsEditor
          page="about"
          initialSections={sections}
          availableSlots={slotCfg.slots}
          slotLabels={slotCfg.labels}
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
