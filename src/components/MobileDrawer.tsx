"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Monogram from "@/components/Monogram";
import LangSwitcher from "@/components/LangSwitcher";
import type { Strings, Lang } from "@/lib/i18n";

type Props = { t: Strings; lang: Lang };

const NAV: Array<{ key: string; path: string; label: (t: Strings, lang: Lang) => string }> = [
  { key: "home", path: "/", label: (t) => t.nav.home },
  { key: "about", path: "/a-propos", label: (t) => t.nav.about },
  { key: "services", path: "/prestations", label: (t) => t.nav.services },
  { key: "portfolio", path: "/portfolio", label: (t) => t.nav.portfolio },
  { key: "concours", path: "/concours", label: (_t, lang) => (lang === "en" ? "CONTEST" : "CONCOURS") },
  { key: "blog", path: "/blog", label: (t) => t.nav.blog },
  { key: "reviews", path: "/avis", label: (t) => t.nav.reviews },
  { key: "contact", path: "/contact", label: (t) => t.nav.contact },
];

function pathActive(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
}

export default function MobileDrawer({ t, lang }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  // close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lock body scroll when open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // close with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mobile-burger"
      >
        <span className={`burger-line ${open ? "x1" : ""}`} />
        <span className={`burger-line ${open ? "x2" : ""}`} />
        <span className={`burger-line ${open ? "x3" : ""}`} />
      </button>

      <div className={`mobile-drawer-scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`mobile-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="mobile-drawer-inner">
          <div style={{ display: "flex", justifyContent: "center", padding: "30px 0 18px" }}>
            <Link href="/" onClick={() => setOpen(false)}>
              <Monogram size={52} />
            </Link>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", padding: "12px 0 8px" }}>
            {NAV.map(({ key, path, label }) => {
              const active = pathActive(pathname, path);
              return (
                <Link
                  key={key}
                  href={path}
                  className={`mobile-link ${active ? "active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  {label(t, lang)}
                </Link>
              );
            })}
          </nav>
          <div style={{ padding: "20px 28px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
            <Link href="/contact" className="btn btn-sage" onClick={() => setOpen(false)} style={{ width: "100%" }}>
              {t.book}
            </Link>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <LangSwitcher lang={lang} />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
