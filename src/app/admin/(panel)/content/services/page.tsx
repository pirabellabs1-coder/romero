import Link from "next/link";
import { getPageContentBilingual, getPageContent } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import { pickShowcasePhotos, photoUrl } from "@/lib/content";
import { listSectionsForPage } from "@/lib/page-sections";
import { PAGE_SLOTS } from "@/lib/page-slots";
import ServicesContentEditor from "@/components/admin/ServicesContentEditor";
import SectionsEditor from "@/components/admin/SectionsEditor";
import { saveContentFields, saveContentPhoto } from "../actions";
import {
  addSectionAction, updateSectionAction, deleteSectionAction,
  moveSectionAction, changeSectionSlotAction,
} from "../sections-actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

function flatDefaults(lang: "fr" | "en"): Record<string, string> {
  const p = STRINGS[lang].services as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === "string") out[k] = v;
  (p.cards as Array<[string, string, string, string]> | undefined)?.forEach(([title, subtitle, price, body], i) => {
    out[`cards_${i}_title`] = title;
    out[`cards_${i}_subtitle`] = subtitle;
    out[`cards_${i}_price`] = price;
    out[`cards_${i}_body`] = body;
  });
  (p.includes as Array<[string, string]> | undefined)?.forEach(([t, b], i) => {
    out[`includes_${i}_title`] = t;
    out[`includes_${i}_body`] = b;
  });
  return out;
}

// Bound Server Actions — one per photo key, declared at module scope so
// each gets its own Server Action identity.
async function savePhotoHero(url: string)     { "use server"; return saveContentPhoto("services", "photo_hero", url); }
async function savePhotoZoom(url: string)     { "use server"; return saveContentPhoto("services", "photo_zoom", url); }
async function savePhotoCard0(url: string)    { "use server"; return saveContentPhoto("services", "photo_card_0", url); }
async function savePhotoCard1(url: string)    { "use server"; return saveContentPhoto("services", "photo_card_1", url); }
async function savePhotoCard2(url: string)    { "use server"; return saveContentPhoto("services", "photo_card_2", url); }
async function savePhotoCard3(url: string)    { "use server"; return saveContentPhoto("services", "photo_card_3", url); }
async function savePhotoGallery0(url: string) { "use server"; return saveContentPhoto("services", "photo_gallery_0", url); }
async function savePhotoGallery1(url: string) { "use server"; return saveContentPhoto("services", "photo_gallery_1", url); }
async function savePhotoGallery2(url: string) { "use server"; return saveContentPhoto("services", "photo_gallery_2", url); }
async function savePhotoGallery3(url: string) { "use server"; return saveContentPhoto("services", "photo_gallery_3", url); }

export default async function ServicesContentPage() {
  cmsPageGuard("services");
  const [overrides, frOnly, fallbackPool, sections] = await Promise.all([
    getPageContentBilingual("services"),
    getPageContent("services", "fr"),
    pickShowcasePhotos(10, "prestations-v3"),
    listSectionsForPage("services"),
  ]);
  const slotCfg = PAGE_SLOTS["services"];
  const pick = (key: string, fallbackIdx: number) =>
    frOnly[key] || photoUrl(fallbackPool[fallbackIdx]) || "/uploads/hero.jpg";
  const heroPhoto    = pick("photo_hero", 0);
  const cardPhotos: [string, string, string, string] = [
    pick("photo_card_0", 1), pick("photo_card_1", 2), pick("photo_card_2", 3), pick("photo_card_3", 4),
  ];
  const zoomPhoto    = pick("photo_zoom", 5);
  const galleryPhotos: [string, string, string, string] = [
    pick("photo_gallery_0", 6), pick("photo_gallery_1", 7), pick("photo_gallery_2", 8), pick("photo_gallery_3", 9),
  ];

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Prestations</h1>
      <p className="admin-sub">Chaque bloc reproduit exactement la structure de la page publique — photos et textes à leurs positions réelles.</p>

      <ServicesContentEditor
        initialFr={overrides.fr}
        initialEn={overrides.en}
        defaultsFr={flatDefaults("fr")}
        defaultsEn={flatDefaults("en")}
        heroPhoto={heroPhoto}
        cardPhotos={cardPhotos}
        zoomPhoto={zoomPhoto}
        galleryPhotos={galleryPhotos}
        saveAction={saveContentFields}
        savePhotoHero={savePhotoHero}
        savePhotoZoom={savePhotoZoom}
        savePhotoCard0={savePhotoCard0}
        savePhotoCard1={savePhotoCard1}
        savePhotoCard2={savePhotoCard2}
        savePhotoCard3={savePhotoCard3}
        savePhotoGallery0={savePhotoGallery0}
        savePhotoGallery1={savePhotoGallery1}
        savePhotoGallery2={savePhotoGallery2}
        savePhotoGallery3={savePhotoGallery3}
      />

      {/* ─── Sections personnalisées ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>➕ Sections personnalisées</h2>
          <p>Ajoutez vos propres sections en haut ou en bas de la page.</p>
        </div>
        <SectionsEditor
          page="services"
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
