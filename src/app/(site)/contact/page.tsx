import type { Metadata } from "next";
import PageEyebrow from "@/components/PageEyebrow";

export const metadata: Metadata = {
  title: "Contact & réservation",
  description:
    "Parlez-moi de votre projet de mariage — date, lieu, ambiance. Réponse sous 48h. Romero Photography, Nice, Côte d'Azur.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact — Romero Photography",
    description: "Réservez votre photographe de mariage à Nice.",
    url: "/contact",
  },
};
import OrnamentDivider from "@/components/OrnamentDivider";
import Rise from "@/components/Rise";
import ContactForm from "@/components/ContactForm";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getSettings } from "@/lib/settings";

export default async function ContactPage() {
  const lang = getLangFromCookies();
  const tRaw = getStrings(lang);
  const settings = await getSettings();
  const ov = await (await import("@/lib/page-content")).getPageContent("contact", lang);

  // Merge CMS overrides over the default contact strings before any UI uses them.
  const baseContact = tRaw.contact;
  const formMerged = {
    ...baseContact.form,
    firstName: ov.form_firstName || baseContact.form.firstName,
    lastName:  ov.form_lastName  || baseContact.form.lastName,
    email:     ov.form_email     || baseContact.form.email,
    phone:     ov.form_phone     || baseContact.form.phone,
    date:      ov.form_date      || baseContact.form.date,
    place:     ov.form_place     || baseContact.form.place,
    message:   ov.form_message   || baseContact.form.message,
    messagePh: ov.form_messagePh || baseContact.form.messagePh,
    submit:    ov.form_submit    || baseContact.form.submit,
    sent:      ov.form_sent      || baseContact.form.sent,
    error:     ov.form_error     || baseContact.form.error,
  };
  const t = {
    ...tRaw,
    contact: {
      ...baseContact,
      eyebrow:       ov.eyebrow       || baseContact.eyebrow,
      title:         ov.title         || baseContact.title,
      titleAccent:   ov.titleAccent   || baseContact.titleAccent,
      lead:          ov.lead          || baseContact.lead,
      coordsEyebrow: ov.coordsEyebrow || baseContact.coordsEyebrow,
      coordsTitle:   ov.coordsTitle   || baseContact.coordsTitle,
      form: formMerged,
      coords: baseContact.coords.map(([iconDef, _mainDef, subDef], i) => [
        ov[`coords_${i}_icon`] || iconDef,
        _mainDef, // overridden by settings below
        ov[`coords_${i}_sub`] || subDef,
      ] as [string, string, string]) as typeof baseContact.coords,
    },
  };

  // Settings still drive the actual city/phone/email values (override CMS for those).
  const coords: [string, string, string][] = [
    [t.contact.coords[0][0], settings.contact_city, t.contact.coords[0][2]],
    [t.contact.coords[1][0], settings.contact_phone, t.contact.coords[1][2]],
    [t.contact.coords[2][0], settings.contact_email, t.contact.coords[2][2]],
  ];

  return (
    <main>
      <PageEyebrow eyebrow={t.contact.eyebrow} title={t.contact.title} accent={t.contact.titleAccent} lead={t.contact.lead} />

      <section className="contact-section" style={{ background: "#fff" }}>
        <div className="container-wide responsive-2col start">
          <Rise>
            <ContactForm t={t} lang={lang} />
          </Rise>

          <Rise delay={120}>
            <div>
              <div className="cap-tracked gold">{t.contact.coordsEyebrow}</div>
              <h2 className="serif" style={{ fontSize: 34, color: "var(--forest)", marginTop: 14, fontWeight: 400 }}>
                {t.contact.coordsTitle}
              </h2>
              <OrnamentDivider />
              <div className="contact-coords-stack" style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 26 }}>
                {coords.map(([icon, primary, secondary], i) => (
                  <div
                    key={i}
                    className="contact-coords-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1fr",
                      gap: 18,
                      paddingBottom: 22,
                      borderBottom: i < 2 ? "1px solid var(--rule)" : "none",
                    }}
                  >
                    <span style={{ color: "var(--gold)", fontSize: 18 }}>{icon}</span>
                    <div style={{ minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      <div className="serif" style={{ fontSize: 18, color: "var(--forest)", overflowWrap: "anywhere" }}>
                        {primary}
                      </div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {secondary}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="contact-coords-extra" style={{ marginTop: 40 }}>
                <div className="cap-tracked-sm gold">{t.contact.socialEyebrow}</div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <a
                    href={settings.instagram_url || `https://www.instagram.com/${(settings.instagram_handle || "").replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Suivre Romero Photography sur Instagram"
                    style={{ display: "inline-flex", alignItems: "center", gap: 12, color: "var(--forest)", flexWrap: "wrap" }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      style={{ color: "var(--gold)", flexShrink: 0 }}
                    >
                      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    Instagram : {settings.instagram_handle}
                  </a>
                </div>
              </div>
            </div>
          </Rise>
        </div>
      </section>
    </main>
  );
}
