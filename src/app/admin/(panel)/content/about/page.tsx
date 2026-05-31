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
    title: "① En-tête de la page",
    description: "Le bandeau d'introduction tout en haut.",
    fields: [
      { key: "eyebrow", label: "Surtitre (small caps)" },
      { key: "title",   label: "Titre — partie principale" },
      { key: "titleAccent", label: "Titre — partie en italique doré" },
      { key: "lead", label: "Sous-titre / accroche", variant: "textarea" },
    ],
  },
  {
    title: "② Section « Mon histoire »",
    description: "Le bloc avec l'eyebrow et les paragraphes de votre récit.",
    fields: [
      { key: "bodyEyebrow", label: "Surtitre du bloc" },
      { key: "bodyTitle", label: "Titre du bloc" },
      { key: "body_0", label: "Paragraphe 1", variant: "textarea" },
      { key: "body_1", label: "Paragraphe 2", variant: "textarea" },
      { key: "body_2", label: "Paragraphe 3", variant: "textarea" },
      { key: "body_3", label: "Paragraphe 4", variant: "textarea" },
    ],
  },
  {
    title: "③ Mes valeurs",
    description: "Les 4 piliers affichés en grille.",
    fields: [
      { key: "valuesEyebrow", label: "Surtitre" },
      { key: "valuesTitle", label: "Titre de la section" },
      { key: "values_0_title", label: "Valeur 1 — titre" },
      { key: "values_0_body", label: "Valeur 1 — texte", variant: "textarea" },
      { key: "values_1_title", label: "Valeur 2 — titre" },
      { key: "values_1_body", label: "Valeur 2 — texte", variant: "textarea" },
      { key: "values_2_title", label: "Valeur 3 — titre" },
      { key: "values_2_body", label: "Valeur 3 — texte", variant: "textarea" },
      { key: "values_3_title", label: "Valeur 4 — titre" },
      { key: "values_3_body", label: "Valeur 4 — texte", variant: "textarea" },
    ],
  },
  {
    title: "④ Mon processus",
    description: "Les 4 étapes de votre accompagnement.",
    fields: [
      { key: "processEyebrow", label: "Surtitre" },
      { key: "processTitle", label: "Titre de la section" },
      { key: "process_0_title", label: "Étape 1 — titre" },
      { key: "process_0_body", label: "Étape 1 — texte", variant: "textarea" },
      { key: "process_1_title", label: "Étape 2 — titre" },
      { key: "process_1_body", label: "Étape 2 — texte", variant: "textarea" },
      { key: "process_2_title", label: "Étape 3 — titre" },
      { key: "process_2_body", label: "Étape 3 — texte", variant: "textarea" },
      { key: "process_3_title", label: "Étape 4 — titre" },
      { key: "process_3_body", label: "Étape 4 — texte", variant: "textarea" },
    ],
  },
  {
    title: "⑤ Équipement",
    description: "La section sombre listant votre matériel.",
    fields: [
      { key: "gearEyebrow", label: "Surtitre" },
      { key: "gearTitle", label: "Titre" },
      { key: "gearLead", label: "Texte d'introduction", variant: "textarea" },
      { key: "gear_0", label: "Ligne 1" },
      { key: "gear_1", label: "Ligne 2" },
      { key: "gear_2", label: "Ligne 3" },
      { key: "gear_3", label: "Ligne 4" },
      { key: "gear_4", label: "Ligne 5" },
      { key: "gear_5", label: "Ligne 6" },
      { key: "gear_6", label: "Ligne 7" },
      { key: "gear_7", label: "Ligne 8" },
      { key: "gear_8", label: "Ligne 9" },
      { key: "gear_9", label: "Ligne 10" },
    ],
  },
];

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
  return out;
}

// Server Actions bound to specific photo keys for HeroPhotoUploader.
async function saveAboutEyebrowPhoto(url: string) {
  "use server";
  return saveContentPhoto("about", "photo_eyebrow", url);
}
async function saveAboutStoryPhoto(url: string) {
  "use server";
  return saveContentPhoto("about", "photo_story", url);
}

export default async function AboutContentPage() {
  cmsPageGuard("about");
  // Resolve current photo URLs: override (if set) or the dynamic fallback
  // that the public page would otherwise show.
  const [overrides, fallbackPool, frOnly] = await Promise.all([
    getPageContentBilingual("about"),
    pickShowcasePhotos(2, "about-v1"),
    getPageContent("about", "fr"),
  ]);
  const eyebrowPhoto = frOnly["photo_eyebrow"] || photoUrl(fallbackPool[0]) || "/uploads/hero.jpg";
  const storyPhoto = frOnly["photo_story"] || photoUrl(fallbackPool[1]) || "/uploads/hero.jpg";

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page À propos</h1>
      <p className="admin-sub">Modifiez chaque texte et chaque photo dans l&apos;ordre d&apos;apparition.</p>

      {/* ── Photos de la page ────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>📷 Photos</h2>
          <p>Les deux photos affichées sur la page À propos. Cliquez sur « Remplacer la photo » pour en uploader une autre.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label className="admin-label" style={{ marginBottom: 8, display: "block" }}>
              Photo principale (à droite du titre)
            </label>
            <HeroPhotoUploader
              currentUrl={eyebrowPhoto}
              caption="Affichée à droite du bandeau d'introduction."
              ratio="3 / 4"
              saveAction={saveAboutEyebrowPhoto}
            />
          </div>
          <div>
            <label className="admin-label" style={{ marginBottom: 8, display: "block" }}>
              Photo « Mon histoire »
            </label>
            <HeroPhotoUploader
              currentUrl={storyPhoto}
              caption="Affichée à côté du texte de votre histoire."
              ratio="3 / 4"
              saveAction={saveAboutStoryPhoto}
            />
          </div>
        </div>
      </div>

      <PageContentEditor
        page="about"
        viewPath="/a-propos"
        sections={SECTIONS}
        initialFr={overrides.fr}
        initialEn={overrides.en}
        defaultsFr={flatAboutDefaults("fr")}
        defaultsEn={flatAboutDefaults("en")}
        saveAction={saveContentFields}
      />
    </>
  );
}
