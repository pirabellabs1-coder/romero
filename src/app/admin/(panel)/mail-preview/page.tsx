import Link from "next/link";
import { queryOne } from "@/lib/db";
import { renderContactEmailHtml, type ContactMail } from "@/lib/mailer";
import { sendTestEmail } from "./actions";

export const dynamic = "force-dynamic";

const FAKE: ContactMail = {
  firstName: "Camille",
  lastName: "Dupont",
  email: "camille.dupont@example.com",
  phone: "06 12 34 56 78",
  weddingDate: "2026-08-15",
  place: "Villa Ephrussi de Rothschild, Cap Ferrat",
  message:
    "Bonjour Mickael,\n\nNous serions ravis de vous avoir comme photographe pour notre mariage le 15 août 2026 à la Villa Ephrussi de Rothschild. Nous adorons votre travail, notamment vos reportages à Èze.\n\nSerait-il possible d'avoir vos disponibilités et un devis détaillé ? Nous prévoyons 80 invités, une cérémonie laïque en fin d'après-midi et un dîner sur la terrasse.\n\nMerci beaucoup,\nCamille & Antoine",
  lang: "fr",
};

type RealMessage = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  wedding_date: string;
  place: string;
  message: string;
  lang: string;
};

export default async function MailPreview({ searchParams }: { searchParams: { source?: string; sent?: string; error?: string } }) {
  let data: ContactMail = FAKE;
  let isReal = false;

  if (searchParams.source === "latest") {
    const row = await queryOne<RealMessage>("SELECT * FROM messages ORDER BY id DESC LIMIT 1");
    if (row) {
      isReal = true;
      data = {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        weddingDate: row.wedding_date,
        place: row.place,
        message: row.message,
        lang: row.lang,
      };
    }
  }

  const html = renderContactEmailHtml(data);
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const mailTo = process.env.MAIL_TO || "(fallback vers contact_email des paramètres)";

  return (
    <>
      <h1 className="admin-h1">Aperçu du mail</h1>
      <p className="admin-sub">Visualisez à quoi ressemble l&apos;e-mail envoyé au photographe lorsqu&apos;un visiteur remplit le formulaire de contact.</p>

      {searchParams.sent === "1" && (
        <div className="admin-flash ok">
          ✓ Email de test envoyé avec succès à <b>{mailTo}</b>. Vérifiez votre boîte de réception (+ spam).
        </div>
      )}
      {searchParams.error && (
        <div className="admin-flash error">
          ✗ Erreur lors de l&apos;envoi : <b>{searchParams.error}</b>. Vérifiez les variables d&apos;environnement dans .env.local et redémarrez le dev server.
        </div>
      )}

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 20, color: "var(--forest)", margin: "0 0 14px" }}>Configuration actuelle</h2>
        <table className="admin-table" style={{ minWidth: 0 }}>
          <tbody>
            <tr>
              <td style={{ width: 220, color: "var(--muted)" }}>Provider Resend</td>
              <td>
                {hasResend ? (
                  <span style={{ color: "var(--forest)" }}>✓ Clé API configurée</span>
                ) : (
                  <span style={{ color: "#8B2E2E" }}>✗ <code>RESEND_API_KEY</code> non défini dans <code>.env.local</code></span>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Provider SMTP (fallback)</td>
              <td>{hasSmtp ? "✓ configuré" : <span style={{ color: "var(--muted)" }}>non configuré</span>}</td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Destinataire (<code>MAIL_TO</code>)</td>
              <td><b>{mailTo}</b></td>
            </tr>
            <tr>
              <td style={{ color: "var(--muted)" }}>Expéditeur (<code>MAIL_FROM</code>)</td>
              <td>{process.env.MAIL_FROM || "(défaut Resend)"}</td>
            </tr>
          </tbody>
        </table>
        {!hasResend && (
          <div style={{ marginTop: 16, padding: 16, background: "var(--cream)", border: "1px solid var(--rule)", borderRadius: 4, fontSize: 13.5, lineHeight: 1.65 }}>
            <b>Pour activer l&apos;envoi via Resend&nbsp;:</b>
            <ol style={{ margin: "8px 0 0 18px", padding: 0 }}>
              <li>Créez un compte gratuit sur <a href="https://resend.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>resend.com</a></li>
              <li>Allez sur <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>API Keys</a> et créez-en une</li>
              <li>Collez la clé dans <code>C:\Romero\site\.env.local</code> :<br/>
                <code style={{ display: "inline-block", marginTop: 6, padding: "4px 10px", background: "#FFFCF7", border: "1px solid var(--rule)", borderRadius: 3 }}>RESEND_API_KEY=re_xxxxxxxxxxxxx</code>
              </li>
              <li>Redémarrez le dev server (Ctrl+C puis <code>npm run dev</code>)</li>
            </ol>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 20, color: "var(--forest)", margin: 0 }}>Aperçu du rendu</h2>
            <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>
              {isReal ? "Basé sur le dernier message reçu." : "Basé sur un exemple fictif (Camille Dupont)."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/mail-preview" className={`admin-btn ghost ${!isReal ? "" : ""}`} style={isReal ? {} : { background: "var(--cream-deep)" }}>
              EXEMPLE FICTIF
            </Link>
            <Link href="/admin/mail-preview?source=latest" className="admin-btn ghost" style={isReal ? { background: "var(--cream-deep)" } : {}}>
              DERNIER MESSAGE REÇU
            </Link>
            <form action={sendTestEmail}>
              <input type="hidden" name="source" value={isReal ? "latest" : "fake"} />
              <button type="submit" className="admin-btn">ENVOYER UN TEST</button>
            </form>
          </div>
        </div>

        <details className="mail-preview-details">
          <summary className="mail-preview-summary">
            <span>Afficher l&apos;aperçu visuel</span>
            <span className="cap-tracked-sm gold" style={{ fontSize: 10 }}>CLIQUER POUR DÉPLIER</span>
          </summary>
          <div
            style={{
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",
              borderRadius: 6,
              border: "1px solid var(--rule)",
              marginTop: 14,
            }}
          >
            <iframe
              srcDoc={html}
              title="Aperçu de l'email"
              style={{
                width: "100%",
                maxWidth: "100%",
                height: 520,
                border: 0,
                background: "#fff",
                display: "block",
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "10px 0 0", textAlign: "right" }}>
            Aperçu visuel — pour tester le rendu réel, cliquez sur <b>ENVOYER UN TEST</b> ci-dessus.
          </p>
        </details>
      </div>
    </>
  );
}
