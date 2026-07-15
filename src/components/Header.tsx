"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Monogram from "@/components/Monogram";
import LangSwitcher from "@/components/LangSwitcher";
import MobileDrawer from "@/components/MobileDrawer";
import type { Strings, Lang } from "@/lib/i18n";

type Props = {
  t: Strings;
  lang: Lang;
};

const PATHS = {
  home: "/",
  about: "/a-propos",
  services: "/prestations",
  portfolio: "/portfolio",
  concours: "/concours",
  blog: "/blog",
  reviews: "/avis",
  contact: "/contact",
} as const;

type NavKey = keyof typeof PATHS;

function isActive(pathname: string, key: NavKey) {
  const path = PATHS[key];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
}

export default function Header({ t, lang }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const left: [NavKey, string][] = [
    ["home", t.nav.home],
    ["about", t.nav.about],
    ["services", t.nav.services],
    ["portfolio", t.nav.portfolio],
  ];
  const right: [NavKey, string][] = [
    ["concours", lang === "en" ? "THE GRAND CONTEST" : "LE GRAND CONCOURS"],
    ["blog", t.nav.blog],
    ["reviews", t.nav.reviews],
    ["contact", t.nav.contact],
  ];

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
      <div className="site-header-inner">
        <nav className="site-nav site-nav-left">
          {left.map(([key, label]) => (
            <Link key={key} href={PATHS[key]} className={`nav-link ${isActive(pathname, key) ? "active" : ""}`}>
              {label}
            </Link>
          ))}
        </nav>

        <Link href="/" className="site-mono" aria-label="Romero Photography - Accueil">
          <Monogram size={scrolled ? 44 : 56} />
        </Link>

        <nav className="site-nav site-nav-right">
          {right.map(([key, label]) => (
            <Link key={key} href={PATHS[key]} className={`nav-link ${isActive(pathname, key) ? "active" : ""}`}>
              {label}
            </Link>
          ))}
          <div className="site-utility-inline">
            <Link
              href="/contact"
              className="btn btn-gold-outline header-book-btn"
              aria-label={t.book}
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).fbq) {
                  (window as any).fbq("trackCustom", "ClicReserver");
                }
              }}
            >
              <span className="hide-on-tight">{t.book}</span>
              <span className="show-on-tight" aria-hidden>{lang === "en" ? "BOOK" : "RÉSERVER"}</span>
            </Link>
            <LangSwitcher lang={lang} />
          </div>
        </nav>

        <MobileDrawer t={t} lang={lang} />
      </div>
    </header>
  );
}
