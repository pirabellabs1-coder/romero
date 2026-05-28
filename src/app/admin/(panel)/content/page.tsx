import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGES: Array<{ slug: string; title: string; description: string; href: string }> = [
  { slug: "home",      title: "Accueil",       description: "Titre principal, valeurs, citation, à la une.", href: "/" },
  { slug: "nav",       title: "Navigation",    description: "Liens du menu et bouton réserver.",              href: "/" },
  { slug: "footer",    title: "Pied de page",  description: "Crédits, liens secondaires.",                    href: "/" },
  { slug: "about",     title: "À propos",      description: "Présentation du photographe et son histoire.",   href: "/a-propos" },
  { slug: "services",  title: "Prestations",   description: "Forfaits, déroulé, expertise.",                  href: "/prestations" },
  { slug: "portfolio", title: "Portfolio",     description: "Intro et filtres de la page portfolio.",         href: "/portfolio" },
  { slug: "blog",      title: "Journal",       description: "Intro du blog et catégories.",                   href: "/blog" },
  { slug: "reviews",   title: "Avis",          description: "En-têtes de la page avis Google.",               href: "/avis" },
  { slug: "contact",   title: "Contact",       description: "Texte d'accroche et libellés du formulaire.",    href: "/contact" },
];

export default async function ContentIndex() {
  // Count overrides per page so the admin sees what's been customised.
  const counts = await query<{ page: string; c: number }>(
    "SELECT page, COUNT(*)::int AS c FROM page_content GROUP BY page"
  );
  const countMap = new Map(counts.map((r) => [r.page, r.c]));

  return (
    <>
      <h1 className="admin-h1">Contenu</h1>
      <p className="admin-sub">
        Modifiez n&apos;importe quel texte du site sans toucher au code. Les changements sont enregistrés à chaud
        et publiés immédiatement.
      </p>

      <div className="admin-card">
        <div className="content-page-list">
          {PAGES.map((p) => {
            const overrides = countMap.get(p.slug) ?? 0;
            // Hidden until the post-delivery review with the client.
            // To re-enable: list the slugs the client should see.
            const ready = ["home"].includes(p.slug);
            return ready ? (
              <Link key={p.slug} href={`/admin/content/${p.slug}`} className="content-page-card">
                <h3 className="content-page-card__title">{p.title}</h3>
                <p className="content-page-card__sub">{p.description}</p>
                <p className="content-page-card__count">
                  {overrides > 0
                    ? `${overrides} champ${overrides > 1 ? "s" : ""} personnalisé${overrides > 1 ? "s" : ""}`
                    : "Aucune personnalisation"}
                </p>
              </Link>
            ) : (
              <div key={p.slug} className="content-page-card" style={{ opacity: 0.45, cursor: "not-allowed" }} title="Bientôt">
                <h3 className="content-page-card__title">{p.title}</h3>
                <p className="content-page-card__sub">{p.description}</p>
                <p className="content-page-card__count" style={{ color: "var(--muted)" }}>Bientôt</p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
