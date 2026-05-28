import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import { saveContentFields } from "../actions";

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

export default async function ServicesContentPage() {
  const overrides = await getPageContentBilingual("services");
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Prestations</h1>
      <p className="admin-sub">Modifiez les forfaits, descriptions et bouton final.</p>
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
