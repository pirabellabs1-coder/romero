import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import { saveContentFields } from "../actions";
import { listSectionsForPage } from "@/lib/page-sections";
import { PAGE_SLOTS } from "@/lib/page-slots";
import SectionsEditor from "@/components/admin/SectionsEditor";
import {
  addSectionAction, updateSectionAction, deleteSectionAction,
  moveSectionAction, changeSectionSlotAction,
} from "../sections-actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

const SECTIONS: SectionSpec[] = [
  {
    title: "En-tête de la page Avis",
    fields: [
      { key: "eyebrow", label: "Surtitre" },
      { key: "title", label: "Titre — partie principale" },
      { key: "titleAccent", label: "Titre — partie en italique doré" },
      { key: "lead", label: "Sous-titre", variant: "textarea" },
    ],
  },
  {
    title: "Bloc Google",
    description: "Trois chiffres et le bouton Google sous le bandeau d'en-tête.",
    fields: [
      { key: "googleCta", label: "Texte du bouton Google" },
      { key: "stats_0_value", label: "Chiffre 1 (ex : « 5,0 »)" },
      { key: "stats_0_label", label: "Légende 1 (ex : « NOTE GOOGLE »)" },
      { key: "stats_1_value", label: "Chiffre 2 (ex : « +50 »)" },
      { key: "stats_1_label", label: "Légende 2 (ex : « AVIS CLIENTS »)" },
      { key: "stats_2_value", label: "Chiffre 3 (ex : « 100% »)" },
      { key: "stats_2_label", label: "Légende 3 (ex : « RECOMMANDATIONS »)" },
    ],
  },
  {
    title: "Bandeau « En direct de Google »",
    description: "Au-dessus du carrousel des avis.",
    fields: [
      { key: "live", label: "Étiquette small caps (« EN DIRECT DE GOOGLE »)" },
      { key: "liveTitle", label: "Titre de la section" },
    ],
  },
];

function flatDefaults(lang: "fr" | "en"): Record<string, string> {
  const p = STRINGS[lang].reviews as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === "string") out[k] = v;
  (p.stats as Array<[string, string]> | undefined)?.forEach(([v, lbl], i) => {
    out[`stats_${i}_value`] = v; out[`stats_${i}_label`] = lbl;
  });
  return out;
}

export default async function ReviewsContentPage() {
  cmsPageGuard("reviews");
  const overrides = await getPageContentBilingual("reviews");
  const sections = await listSectionsForPage("reviews");
  const slotCfg = PAGE_SLOTS["reviews"];
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Avis</h1>
      <p className="admin-sub">Les avis eux-mêmes se gèrent via <Link href="/admin/reviews" className="gold">l&apos;onglet Avis</Link>.</p>
      <PageContentEditor
        page="reviews"
        viewPath="/avis"
        sections={SECTIONS}
        initialFr={overrides.fr}
        initialEn={overrides.en}
        defaultsFr={flatDefaults("fr")}
        defaultsEn={flatDefaults("en")}
        saveAction={saveContentFields}
      />
    
      <div className="admin-card">
        <div className="content-section-head">
          <h2>➕ Sections personnalisées</h2>
          <p>Ajoutez vos propres sections en haut ou en bas de la page.</p>
        </div>
        <SectionsEditor
          page="reviews"
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