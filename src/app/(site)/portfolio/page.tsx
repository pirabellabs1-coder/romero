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

export default async function PortfolioPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const raw = await listGalleries();
  const covers = await Promise.all(raw.map((g) => coverFor(g, `portfolio-cover-${g.slug}`)));
  const galleries = raw.map((g, i) => ({ ...g, coverUrl: covers[i] }));

  return (
    <main>
      <PageEyebrow eyebrow={t.portfolio.eyebrow} title={t.portfolio.title} accent={t.portfolio.titleAccent} lead={t.portfolio.lead} />
      <PortfolioGrid filters={t.portfolio.filters} galleries={galleries} />
    </main>
  );
}
