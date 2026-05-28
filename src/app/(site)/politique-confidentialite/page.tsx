import type { Metadata } from "next";
import OrnamentDivider from "@/components/OrnamentDivider";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et RGPD du site Romero Photography.",
  alternates: { canonical: "/politique-confidentialite" },
  robots: { index: true, follow: false },
};

export default async function PolitiqueConfidentialitePage() {
  const s = await getSettings();
  return (
    <main className="page-enter">
      <section style={{ paddingTop: 160, paddingBottom: 60, background: "var(--cream)" }}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="cap-tracked gold" style={{ marginBottom: 18 }}>RGPD</div>
          <h1 className="h-display" style={{ margin: 0, fontSize: "clamp(34px, 4vw, 56px)" }}>
            Politique de <span className="italic-gold" style={{ fontStyle: "italic" }}>confidentialité</span>
          </h1>
          <OrnamentDivider />
          <p className="lead muted" style={{ marginTop: 20 }}>
            Nous prenons la protection de vos données très au sérieux. Ce site collecte le strict minimum nécessaire à son fonctionnement.
          </p>
        </div>
      </section>

      <section style={{ background: "var(--cream)", paddingBottom: 90 }}>
        <div className="container rich-prose" style={{ maxWidth: 820 }}>

          <h2>1. Responsable du traitement</h2>
          <p>
            <strong>Mickael Romero</strong> — Romero Photography<br />
            {s.contact_city}<br />
            Email&nbsp;: <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a>
          </p>

          <h2>2. Données collectées</h2>
          <p>
            Lorsque vous utilisez le formulaire de contact, nous collectons&nbsp;:
          </p>
          <ul>
            <li>Votre prénom et nom</li>
            <li>Votre adresse e-mail</li>
            <li>Votre numéro de téléphone (facultatif)</li>
            <li>La date et le lieu de votre mariage (facultatif)</li>
            <li>Le contenu de votre message</li>
            <li>La langue de votre demande</li>
            <li>La date et l&apos;heure de soumission</li>
          </ul>
          <p>
            Aucun cookie publicitaire ni aucun traceur tiers n&apos;est déposé sur votre navigateur. Seul un cookie technique de session est utilisé pour mémoriser votre préférence linguistique (<code>lang</code>).
          </p>

          <h2>3. Finalités du traitement</h2>
          <p>Vos données sont utilisées uniquement pour&nbsp;:</p>
          <ul>
            <li>Répondre à votre demande de contact</li>
            <li>Préparer et organiser une éventuelle prestation photographique</li>
            <li>Conserver une trace de notre échange à des fins comptables ou contractuelles</li>
          </ul>
          <p>
            Vos données ne sont <strong>jamais</strong> vendues, louées, échangées ou transmises à des tiers à des fins commerciales.
          </p>

          <h2>4. Base légale</h2>
          <p>
            Le traitement de vos données repose sur votre <strong>consentement explicite</strong> (envoi du formulaire) et sur l&apos;exécution de mesures précontractuelles prises à votre demande, conformément à l&apos;article 6 du RGPD.
          </p>

          <h2>5. Durée de conservation</h2>
          <ul>
            <li><strong>Demandes de contact sans suite</strong>&nbsp;: 12 mois maximum, puis effacement</li>
            <li><strong>Demandes ayant abouti à une prestation</strong>&nbsp;: conservées pendant la durée légale comptable (10 ans)</li>
            <li><strong>Données techniques (logs, cookies)</strong>&nbsp;: 13 mois maximum</li>
          </ul>

          <h2>6. Sous-traitants</h2>
          <p>Nous utilisons les services suivants, qui peuvent traiter vos données pour notre compte&nbsp;:</p>
          <ul>
            <li><strong>Vercel Inc.</strong> (États-Unis) — hébergement web. Garanties&nbsp;: Clauses Contractuelles Types, DPA.</li>
            <li><strong>Resend</strong> (États-Unis) — envoi de notifications par e-mail. Garanties&nbsp;: Clauses Contractuelles Types, DPA.</li>
          </ul>

          <h2>7. Vos droits</h2>
          <p>Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez des droits suivants&nbsp;:</p>
          <ul>
            <li><strong>Droit d&apos;accès</strong>&nbsp;: obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong>&nbsp;: corriger des informations inexactes</li>
            <li><strong>Droit à l&apos;effacement</strong>&nbsp;: faire supprimer vos données</li>
            <li><strong>Droit à la limitation</strong>&nbsp;: restreindre temporairement le traitement</li>
            <li><strong>Droit à la portabilité</strong>&nbsp;: récupérer vos données dans un format structuré</li>
            <li><strong>Droit d&apos;opposition</strong>&nbsp;: vous opposer au traitement</li>
            <li><strong>Droit de retrait du consentement</strong>&nbsp;: à tout moment</li>
          </ul>
          <p>
            Pour exercer ces droits, envoyez un e-mail à <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a> avec une pièce d&apos;identité. Nous vous répondrons dans un délai maximal d&apos;<strong>un mois</strong>.
          </p>

          <h2>8. Réclamation</h2>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL&nbsp;:<br />
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
          </p>

          <h2>9. Sécurité</h2>
          <p>
            Les communications avec ce site sont chiffrées via HTTPS (TLS). Vos mots de passe sont hachés avec bcrypt. L&apos;accès à l&apos;espace administrateur est protégé par cookie de session signé.
          </p>

          <h2>10. Cookies</h2>
          <p>
            Ce site utilise uniquement des cookies <strong>strictement nécessaires</strong> à son fonctionnement, qui ne requièrent pas votre consentement préalable (article 82 de la loi Informatique et Libertés)&nbsp;:
          </p>
          <ul>
            <li><code>lang</code>&nbsp;: mémorise votre langue (12 mois)</li>
            <li><code>rp_session</code>&nbsp;: session administrateur uniquement (14 jours)</li>
          </ul>
          <p>Aucun cookie publicitaire, aucun traceur Google Analytics, Meta Pixel ou autre. Vous pouvez les supprimer à tout moment dans les paramètres de votre navigateur.</p>

          <p style={{ marginTop: 40, color: "var(--muted)", fontSize: 13 }}>
            Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </section>
    </main>
  );
}
