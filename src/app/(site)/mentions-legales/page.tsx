import type { Metadata } from "next";
import OrnamentDivider from "@/components/OrnamentDivider";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du site Romero Photography — éditeur, hébergeur, propriété intellectuelle.",
  alternates: { canonical: "/mentions-legales" },
  robots: { index: true, follow: false },
};

export default function MentionsLegalesPage() {
  const s = getSettings();
  return (
    <main className="page-enter">
      <section style={{ paddingTop: 160, paddingBottom: 60, background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="cap-tracked gold" style={{ marginBottom: 18 }}>Informations légales</div>
          <h1 className="h-display" style={{ margin: 0, fontSize: "clamp(34px, 4vw, 56px)" }}>
            Mentions <span className="italic-gold" style={{ fontStyle: "italic" }}>légales</span>
          </h1>
          <OrnamentDivider />
        </div>
      </section>

      <section style={{ background: "var(--cream)", paddingBottom: 90 }}>
        <div className="container rich-prose" style={{ maxWidth: 820 }}>
          <h2>Éditeur du site</h2>
          <p>
            <strong>Romero Photography</strong> — Mickael Romero<br />
            Photographe de mariage indépendant<br />
            {s.contact_city}<br />
            Email&nbsp;: <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a><br />
            Téléphone&nbsp;: <a href={`tel:${(s.contact_phone || "").replace(/\s+/g, "")}`}>{s.contact_phone}</a>
          </p>
          <p>
            SIRET&nbsp;: <em>à compléter</em><br />
            Numéro de TVA intracommunautaire&nbsp;: <em>à compléter si assujetti</em>
          </p>

          <h2>Directeur de la publication</h2>
          <p>Mickael Romero, en qualité d&apos;éditeur.</p>

          <h2>Hébergement</h2>
          <p>
            Le site est hébergé par&nbsp;:<br />
            <strong>Vercel Inc.</strong><br />
            340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis<br />
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>
          </p>

          <h2>Conception &amp; réalisation</h2>
          <p>
            Site conçu et développé par <a href="https://pirabellabs.com" target="_blank" rel="noopener noreferrer">Pirabel Labs</a> — Agence Web, Marketing &amp; SEO.
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble du contenu publié sur ce site (photographies, textes, mise en page, identité graphique, logo) est la propriété exclusive de Romero Photography. Toute reproduction, représentation, modification, publication ou exploitation, totale ou partielle, sans autorisation écrite préalable est strictement interdite et constituerait une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.
          </p>
          <p>
            Les photographies présentées dans le portfolio sont protégées par le droit d&apos;auteur. Aucune utilisation commerciale ne peut en être faite sans accord écrit du photographe.
          </p>

          <h2>Limitation de responsabilité</h2>
          <p>
            Romero Photography s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur ce site, mais ne peut garantir l&apos;absence d&apos;erreurs ou d&apos;omissions. L&apos;utilisateur reconnaît utiliser ces informations sous sa responsabilité exclusive.
          </p>

          <h2>Liens hypertextes</h2>
          <p>
            Le site peut contenir des liens vers d&apos;autres sites internet. Romero Photography n&apos;exerce aucun contrôle sur ces sites externes et décline toute responsabilité quant à leur contenu.
          </p>

          <h2>Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents.
          </p>

          <p style={{ marginTop: 40, color: "var(--muted)", fontSize: 13 }}>
            Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </section>
    </main>
  );
}
