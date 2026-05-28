import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import { saveContentFields } from "../actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

const SECTIONS: SectionSpec[] = [
  {
    title: "Liens du menu principal",
    description: "Présent sur toutes les pages du site (en-tête).",
    fields: [
      { key: "home",      label: "« ACCUEIL »" },
      { key: "about",     label: "« À PROPOS »" },
      { key: "services",  label: "« PRESTATIONS »" },
      { key: "portfolio", label: "« PORTFOLIO »" },
      { key: "blog",      label: "« BLOG »" },
      { key: "reviews",   label: "« AVIS »" },
      { key: "contact",   label: "« CONTACT »" },
    ],
  },
  {
    title: "Bouton « Réserver »",
    description: "Le bouton doré dans l'en-tête à droite.",
    fields: [
      { key: "book", label: "Texte du bouton" },
    ],
  },
];

function flatDefaults(lang: "fr" | "en"): Record<string, string> {
  const out: Record<string, string> = {};
  const nav = STRINGS[lang].nav;
  out["home"] = nav.home;
  out["about"] = nav.about;
  out["services"] = nav.services;
  out["portfolio"] = nav.portfolio;
  out["blog"] = nav.blog;
  out["reviews"] = nav.reviews;
  out["contact"] = nav.contact;
  out["book"] = STRINGS[lang].book;
  return out;
}

export default async function NavContentPage() {
  cmsPageGuard("nav");
  const overrides = await getPageContentBilingual("nav");
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Navigation</h1>
      <p className="admin-sub">Liens du menu présents sur toutes les pages.</p>
      <PageContentEditor
        page="nav"
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
