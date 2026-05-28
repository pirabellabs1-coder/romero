import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import { saveContentFields } from "../actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

const SECTIONS: SectionSpec[] = [
  {
    title: "Pied de page",
    description: "Présent sur toutes les pages du site, en bas.",
    fields: [
      { key: "tagline",    label: "Phrase d'accroche", variant: "textarea" },
      { key: "explore",    label: "Titre de colonne « Explorer »" },
      { key: "contactCol", label: "Titre de colonne « Contact »" },
      { key: "legal",      label: "Lien « Mentions légales »" },
      { key: "privacy",    label: "Lien « Politique de confidentialité »" },
      { key: "copy",       label: "Mention copyright", variant: "textarea" },
    ],
  },
];

function flatDefaults(lang: "fr" | "en"): Record<string, string> {
  const f = STRINGS[lang].footer as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (typeof v === "string") out[k] = v;
  return out;
}

export default async function FooterContentPage() {
  cmsPageGuard("footer");
  const overrides = await getPageContentBilingual("footer");
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Pied de page</h1>
      <p className="admin-sub">Visible sur toutes les pages du site.</p>
      <PageContentEditor
        page="footer"
        viewPath="/"
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
