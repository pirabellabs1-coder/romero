import Link from "next/link";
import Monogram from "@/components/Monogram";
import LangSwitcher from "@/components/LangSwitcher";
import type { Strings, Lang } from "@/lib/i18n";
import type { Settings } from "@/lib/settings";

type Props = {
  t: Strings;
  lang: Lang;
  settings: Settings;
};

const PATHS = {
  home: "/",
  about: "/a-propos",
  services: "/prestations",
  portfolio: "/portfolio",
  blog: "/blog",
};

export default function Footer({ t, lang, settings }: Props) {
  const links: [keyof typeof PATHS, string][] = [
    ["home", t.nav.home],
    ["about", t.nav.about],
    ["services", t.nav.services],
    ["portfolio", t.nav.portfolio],
    ["blog", t.nav.blog],
  ];

  const instagramUrl =
    settings.instagram_url ||
    `https://www.instagram.com/${(settings.instagram_handle || "").replace(/^@/, "")}`;

  return (
    <footer
      style={{
        background: "var(--forest)",
        color: "#E5E1D8",
        padding: "90px 0 40px",
        position: "relative",
      }}
    >
      <div className="container-wide footer-grid">
        <div>
          <div style={{ filter: "invert(1) hue-rotate(180deg) brightness(1.1)" }}>
            <Monogram size={66} />
          </div>
          <p style={{ marginTop: 22, color: "#C7C2B6", maxWidth: 320, fontSize: 14, lineHeight: 1.7 }}>
            {t.footer.tagline}
          </p>
        </div>

        <div>
          <div className="cap-tracked-sm" style={{ color: "var(--gold-light)", marginBottom: 18 }}>
            {t.footer.explore}
          </div>
          {links.map(([k, l]) => (
            <Link
              key={k}
              href={PATHS[k]}
              style={{ display: "block", padding: "6px 0", color: "#D9D4C8", fontSize: 13, letterSpacing: ".06em" }}
            >
              {l}
            </Link>
          ))}
        </div>

        <div>
          <div className="cap-tracked-sm" style={{ color: "var(--gold-light)", marginBottom: 18 }}>
            {t.footer.contactCol}
          </div>
          <div style={{ color: "#D9D4C8", fontSize: 13, lineHeight: 1.9 }}>
            <div>{settings.contact_city}</div>
            <div><a href={`tel:${(settings.contact_phone || "").replace(/\s+/g, "")}`} style={{ color: "#D9D4C8" }}>{settings.contact_phone}</a></div>
            <div style={{ fontSize: 12, wordBreak: "normal", overflowWrap: "anywhere" }}>
              <a href={`mailto:${settings.contact_email}`} style={{ color: "#D9D4C8" }}>{settings.contact_email}</a>
            </div>
          </div>
        </div>

        <div>
          <div className="cap-tracked-sm" style={{ color: "var(--gold-light)", marginBottom: 18 }}>
            {lang === "en" ? "FOLLOW" : "SUIVRE"}
          </div>
          <div style={{ color: "#D9D4C8", fontSize: 13, lineHeight: 2 }}>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#D9D4C8", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <span aria-hidden style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: "1px solid rgba(212,185,122,.4)", borderRadius: 4, fontSize: 10, letterSpacing: ".04em", color: "var(--gold-light)" }}>IG</span>
              Instagram
            </a>
          </div>
          <LangSwitcher lang={lang} variant="footer" />
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 70, paddingTop: 24 }}>
        <div
          className="container-wide"
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 11,
            color: "#9B948A",
            letterSpacing: "0.12em",
          }}
        >
          <span>{t.footer.copy}</span>
          <span style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Link href="/mentions-legales" style={{ color: "#9B948A" }}>{t.footer.legal}</Link>
            <Link href="/politique-confidentialite" style={{ color: "#9B948A" }}>{t.footer.privacy}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
