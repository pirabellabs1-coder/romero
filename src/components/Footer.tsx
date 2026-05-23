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
          <p
            style={{
              marginTop: 10,
              color: "var(--gold-light)",
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {t.footer.crafted}
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
            <div>{settings.contact_phone}</div>
            <div style={{ fontSize: 12, wordBreak: "normal", overflowWrap: "anywhere" }}>{settings.contact_email}</div>
          </div>
        </div>

        <div>
          <div className="cap-tracked-sm" style={{ color: "var(--gold-light)", marginBottom: 18 }}>
            SOCIAL
          </div>
          <div style={{ color: "#D9D4C8", fontSize: 13, lineHeight: 2 }}>
            <div>Instagram</div>
            <div>Pinterest</div>
            <div>Vimeo</div>
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
            <span>{t.footer.legal}</span>
            <span>{t.footer.privacy}</span>
          </span>
        </div>
        <div
          className="container-wide"
          style={{
            marginTop: 18,
            paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,.05)",
            textAlign: "center",
            fontSize: 11,
            color: "#9B948A",
            letterSpacing: "0.14em",
          }}
        >
          <a
            href="https://pirabellabs.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Pirabel Labs — Agence Web, Marketing & SEO"
            style={{
              color: "#9B948A",
              textTransform: "uppercase",
              transition: "color .25s ease",
            }}
            className="pirabel-credit"
          >
            Réalisé par <span style={{ color: "var(--gold-light)", fontWeight: 500 }}>Pirabel Labs</span>
            <span style={{ margin: "0 8px", color: "#5C6258" }}>·</span>
            Agence Web, Marketing &amp; SEO
          </a>
        </div>
      </div>
    </footer>
  );
}
