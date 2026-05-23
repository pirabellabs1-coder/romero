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

export default function ContactPage() {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const settings = getSettings();

  // Replace coord values from settings (fall back to translation defaults)
  const coords: [string, string, string][] = [
    [t.contact.coords[0][0], settings.contact_city, t.contact.coords[0][2]],
    [t.contact.coords[1][0], settings.contact_phone, t.contact.coords[1][2]],
    [t.contact.coords[2][0], settings.contact_email, t.contact.coords[2][2]],
  ];

  return (
    <main>
      <PageEyebrow eyebrow={t.contact.eyebrow} title={t.contact.title} accent={t.contact.titleAccent} lead={t.contact.lead} />

      <section style={{ background: "#fff", padding: "40px 0 120px" }}>
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
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 26 }}>
                {coords.map(([icon, primary, secondary], i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1fr",
                      gap: 18,
                      paddingBottom: 22,
                      borderBottom: i < 2 ? "1px solid var(--rule)" : "none",
                    }}
                  >
                    <span style={{ color: "var(--gold)", fontSize: 18 }}>{icon}</span>
                    <div>
                      <div className="serif" style={{ fontSize: 18, color: "var(--forest)" }}>
                        {primary}
                      </div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        {secondary}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 40 }}>
                <div className="cap-tracked-sm gold">{t.contact.socialEyebrow}</div>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--forest)" }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        border: "1px solid var(--rule)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                      }}
                    >
                      IG
                    </span>
                    Instagram : {settings.instagram_handle}
                  </div>
                </div>
              </div>
            </div>
          </Rise>
        </div>
      </section>
    </main>
  );
}
