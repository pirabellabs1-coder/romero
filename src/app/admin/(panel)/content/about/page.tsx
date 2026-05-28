import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import { saveContentFields } from "../actions";
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

export default async function AboutContentPage() {
  cmsPageGuard("about");
  const overrides = await getPageContentBilingual("about");
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page À propos</h1>
      <p className="admin-sub">Modifiez chaque texte dans l&apos;ordre d&apos;apparition. FR + EN via les boutons en haut.</p>

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
