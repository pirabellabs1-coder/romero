import Link from "next/link";
import { getPageContentBilingual, getPageContent } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import { pickShowcasePhotos, photoUrl } from "@/lib/content";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import HeroPhotoUploader from "@/components/admin/HeroPhotoUploader";
import { saveContentFields, saveContentPhoto } from "../actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

const SECTIONS: SectionSpec[] = [
  {
    title: "En-tête de la page Prestations",
    fields: [
      { key: "eyebrow", label: "Surtitre" },
      { key: "title", label: "Titre — partie principale" },
      { key: "titleAccent", label: "Titre — partie en italique doré" },
      { key: "lead", label: "Sous-titre", variant: "textarea" },
    ],
  },
  {
    title: "Les 4 cartes de prestations",
    description: "Chaque carte : titre court, baseline, prix, descriptif.",
    fields: [
      { key: "cards_0_title", label: "Carte 1 — titre" },
      { key: "cards_0_subtitle", label: "Carte 1 — baseline" },
      { key: "cards_0_price", label: "Carte 1 — prix" },
      { key: "cards_0_body", label: "Carte 1 — description", variant: "textarea" },
      { key: "cards_1_title", label: "Carte 2 — titre" },
      { key: "cards_1_subtitle", label: "Carte 2 — baseline" },
      { key: "cards_1_price", label: "Carte 2 — prix" },
      { key: "cards_1_body", label: "Carte 2 — description", variant: "textarea" },
      { key: "cards_2_title", label: "Carte 3 — titre" },
      { key: "cards_2_subtitle", label: "Carte 3 — baseline" },
      { key: "cards_2_price", label: "Carte 3 — prix" },
      { key: "cards_2_body", label: "Carte 3 — description", variant: "textarea" },
      { key: "cards_3_title", label: "Carte 4 — titre" },
      { key: "cards_3_subtitle", label: "Carte 4 — baseline" },
      { key: "cards_3_price", label: "Carte 4 — prix" },
      { key: "cards_3_body", label: "Carte 4 — description", variant: "textarea" },
    ],
  },
  {
    title: "Bloc « Formules mariage »",
    fields: [
      { key: "zoomEyebrow", label: "Surtitre" },
      { key: "zoomTitle", label: "Titre du bloc" },
      { key: "zoomIntro", label: "Texte d'intro", variant: "textarea" },
      { key: "includes_0_title", label: "Formule 1 — titre" },
      { key: "includes_0_body", label: "Formule 1 — texte", variant: "textarea" },
      { key: "includes_1_title", label: "Formule 2 — titre" },
      { key: "includes_1_body", label: "Formule 2 — texte", variant: "textarea" },
      { key: "includes_2_title", label: "Formule 3 — titre" },
      { key: "includes_2_body", label: "Formule 3 — texte", variant: "textarea" },
      { key: "includes_3_title", label: "Formule 4 — titre" },
      { key: "includes_3_body", label: "Formule 4 — texte", variant: "textarea" },
    ],
  },
  {
    title: "Galerie + CTA",
    fields: [
      { key: "galleryEyebrow", label: "Surtitre du bloc galerie" },
      { key: "cta", label: "Bouton CTA final" },
    ],
  },
];

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

// Bind one Server Action per photo key so each uploader has its own.
function makeSavePhoto(key: string) {
  return async function (url: string) {
    "use server";
    return saveContentPhoto("services", key, url);
  };
}

// Pre-declared (server functions can't be created inline in JSX).
const SAVE_PHOTO_HERO    = makeSavePhoto("photo_hero");
const SAVE_PHOTO_ZOOM    = makeSavePhoto("photo_zoom");
const SAVE_PHOTO_CARD_0  = makeSavePhoto("photo_card_0");
const SAVE_PHOTO_CARD_1  = makeSavePhoto("photo_card_1");
const SAVE_PHOTO_CARD_2  = makeSavePhoto("photo_card_2");
const SAVE_PHOTO_CARD_3  = makeSavePhoto("photo_card_3");
const SAVE_PHOTO_GAL_0   = makeSavePhoto("photo_gallery_0");
const SAVE_PHOTO_GAL_1   = makeSavePhoto("photo_gallery_1");
const SAVE_PHOTO_GAL_2   = makeSavePhoto("photo_gallery_2");
const SAVE_PHOTO_GAL_3   = makeSavePhoto("photo_gallery_3");

export default async function ServicesContentPage() {
  cmsPageGuard("services");
  const [overrides, frOnly, fallbackPool] = await Promise.all([
    getPageContentBilingual("services"),
    getPageContent("services", "fr"),
    pickShowcasePhotos(10, "prestations-v3"),
  ]);
  // Resolve each photo: override (admin upload) wins, else random pool.
  const pick = (key: string, fallbackIdx: number) =>
    frOnly[key] || photoUrl(fallbackPool[fallbackIdx]) || "/uploads/hero.jpg";
  const heroPhoto    = pick("photo_hero", 0);
  const cardPhotos   = [pick("photo_card_0", 1), pick("photo_card_1", 2), pick("photo_card_2", 3), pick("photo_card_3", 4)];
  const zoomPhoto    = pick("photo_zoom", 5);
  const galleryPhotos = [pick("photo_gallery_0", 6), pick("photo_gallery_1", 7), pick("photo_gallery_2", 8), pick("photo_gallery_3", 9)];

  const CARD_LABELS = ["Mariage", "Séance d'engagement", "Portrait", "Lifestyle"];

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Prestations</h1>
      <p className="admin-sub">Modifiez les forfaits, descriptions, photos et bouton final.</p>

      {/* ── Photos de la page ────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>📷 Photos</h2>
          <p>10 photos sont affichées sur la page Prestations. Remplacez-en n&apos;importe laquelle. Si vous ne mettez rien, une photo de vos galeries est tirée au sort.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Hero */}
          <div>
            <label className="admin-label" style={{ marginBottom: 8, display: "block" }}>① Photo principale (bandeau d&apos;accueil)</label>
            <div style={{ maxWidth: 320 }}>
              <HeroPhotoUploader currentUrl={heroPhoto} caption="Affichée à droite du titre de la page." ratio="3 / 4" saveAction={SAVE_PHOTO_HERO} />
            </div>
          </div>

          {/* 4 card photos */}
          <div>
            <label className="admin-label" style={{ marginBottom: 8, display: "block" }}>② Photos des 4 cartes prestations</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {[SAVE_PHOTO_CARD_0, SAVE_PHOTO_CARD_1, SAVE_PHOTO_CARD_2, SAVE_PHOTO_CARD_3].map((save, i) => (
                <div key={i}>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>{CARD_LABELS[i]}</p>
                  <HeroPhotoUploader currentUrl={cardPhotos[i]} caption="" ratio="4 / 3" saveAction={save} />
                </div>
              ))}
            </div>
          </div>

          {/* Zoom photo */}
          <div>
            <label className="admin-label" style={{ marginBottom: 8, display: "block" }}>③ Photo du bloc « Formules mariage »</label>
            <div style={{ maxWidth: 360 }}>
              <HeroPhotoUploader currentUrl={zoomPhoto} caption="Photo qui accompagne le bloc des formules." ratio="3 / 2" saveAction={SAVE_PHOTO_ZOOM} />
            </div>
          </div>

          {/* 4 gallery photos */}
          <div>
            <label className="admin-label" style={{ marginBottom: 8, display: "block" }}>④ Photos de la galerie en bas</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              {[SAVE_PHOTO_GAL_0, SAVE_PHOTO_GAL_1, SAVE_PHOTO_GAL_2, SAVE_PHOTO_GAL_3].map((save, i) => (
                <div key={i}>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>Photo {i + 1}</p>
                  <HeroPhotoUploader currentUrl={galleryPhotos[i]} caption="" ratio="4 / 5" saveAction={save} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PageContentEditor
        page="services"
        viewPath="/prestations"
        sections={SECTIONS}
        initialFr={overrides.fr}
        initialEn={overrides.en}
        defaultsFr={flatDefaults("fr")}
        defaultsEn={flatDefaults("en")}
        saveAction={saveContentFields}
      />
    </>
  );
}
