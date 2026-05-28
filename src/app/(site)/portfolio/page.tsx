import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";

export const metadata: Metadata = {
  title: "Portfolio mariages",
  description:
    "Découvrez les mariages photographiés par Romero Photography : Côte d'Azur, France, international. Reportages élégants et intemporels.",
  alternates: { canonical: "/portfolio" },
  openGraph: {
    title: "Portfolio mariages — Romero Photography",
    description: "Les mariages que j'ai eu l'honneur de photographier.",
    url: "/portfolio",
  },
};
import PortfolioGrid from "@/components/PortfolioGrid";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { listGalleries, coverFor } from "@/lib/content";
import { getPageContent } from "@/lib/page-content";

export default async function PortfolioPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const [raw, ov] = await Promise.all([listGalleries(), getPageContent("portfolio", lang)]);
  const covers = await Promise.all(raw.map((g) => coverFor(g, `portfolio-cover-${g.slug}`)));
  const galleries = raw.map((g, i) => ({ ...g, coverUrl: covers[i] }));

  const portfolio = {
    eyebrow:     ov.eyebrow     || t.portfolio.eyebrow,
    title:       ov.title       || t.portfolio.title,
    titleAccent: ov.titleAccent || t.portfolio.titleAccent,
    lead:        ov.lead        || t.portfolio.lead,
  };
  const filters = (t.portfolio.filters as ReadonlyArray<string>).map((f, i) => ov[`filters_${i}`] || f);

  return (
    <main>
      <PageEyebrow eyebrow={portfolio.eyebrow} title={portfolio.title} accent={portfolio.titleAccent} lead={portfolio.lead} />
      <PortfolioGrid filters={filters} galleries={galleries} />
    </main>
  );
}
