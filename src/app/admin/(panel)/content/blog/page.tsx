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
    title: "En-tête du Journal",
    description: "Le bandeau au-dessus de la liste des articles.",
    fields: [
      { key: "eyebrow", label: "Surtitre (small caps)" },
      { key: "title", label: "Titre — partie principale" },
      { key: "titleAccent", label: "Titre — partie en italique doré" },
      { key: "lead", label: "Sous-titre", variant: "textarea" },
    ],
  },
  {
    title: "Filtres et étiquettes",
    description: "Boutons de catégorie au-dessus des articles + libellés répétés.",
    fields: [
      { key: "featured", label: "Étiquette « À la une » sur l'article principal" },
      { key: "readMore", label: "Bouton « Lire l'article » sur chaque carte" },
      { key: "categories_0", label: "Filtre 1 (« TOUS »)" },
      { key: "categories_1", label: "Filtre 2 (« MARIAGES »)" },
      { key: "categories_2", label: "Filtre 3 (« LIEUX »)" },
      { key: "categories_3", label: "Filtre 4 (« CONSEILS »)" },
    ],
  },
];

function flatDefaults(lang: "fr" | "en"): Record<string, string> {
  const p = STRINGS[lang].blog as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === "string") out[k] = v;
  (p.categories as string[] | undefined)?.forEach((c, i) => { out[`categories_${i}`] = c; });
  return out;
}

export default async function BlogContentPage() {
  cmsPageGuard("blog");
  const overrides = await getPageContentBilingual("blog");
  const sections = await listSectionsForPage("blog");
  const slotCfg = PAGE_SLOTS["blog"];
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Journal</h1>
      <p className="admin-sub">Les articles eux-mêmes se gèrent via <Link href="/admin/posts" className="gold">l&apos;onglet Journal</Link>.</p>
      <PageContentEditor
        page="blog"
        viewPath="/blog"
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
          page="blog"
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