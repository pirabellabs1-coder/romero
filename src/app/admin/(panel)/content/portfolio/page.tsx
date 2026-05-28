import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import { saveContentFields } from "../actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

const SECTIONS: SectionSpec[] = [
  {
    title: "En-tête de la page Portfolio",
    description: "Le bandeau au-dessus de la grille des galeries.",
    fields: [
      { key: "eyebrow", label: "Surtitre (small caps)" },
      { key: "title", label: "Titre — partie principale" },
      { key: "titleAccent", label: "Titre — partie en italique doré" },
      { key: "lead", label: "Sous-titre", variant: "textarea" },
    ],
  },
  {
    title: "Filtres de la grille",
    description: "Boutons au-dessus des galeries (Tous, France, International).",
    fields: [
      { key: "filters_0", label: "Filtre 1 (« TOUS »)" },
      { key: "filters_1", label: "Filtre 2 (« FRANCE »)" },
      { key: "filters_2", label: "Filtre 3 (« INTERNATIONAL »)" },
    ],
  },
];

function flatDefaults(lang: "fr" | "en"): Record<string, string> {
  const p = STRINGS[lang].portfolio as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === "string") out[k] = v;
  (p.filters as string[] | undefined)?.forEach((f, i) => { out[`filters_${i}`] = f; });
  return out;
}

export default async function PortfolioContentPage() {
  cmsPageGuard("portfolio");
  const overrides = await getPageContentBilingual("portfolio");
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Portfolio</h1>
      <p className="admin-sub">Le contenu des galeries de mariage se gère via <Link href="/admin/galleries" className="gold">l&apos;onglet Galeries</Link>.</p>
      <PageContentEditor
        page="portfolio"
        viewPath="/portfolio"
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
