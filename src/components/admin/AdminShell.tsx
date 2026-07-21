"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  unread: number;
  profile?: { name: string; email: string; picture?: string };
  children: React.ReactNode;
};

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/approvals", label: "Réponses IA" },
  { href: "/admin/calendar", label: "Calendrier" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/content", label: "Contenu" },
  { href: "/admin/galleries", label: "Galeries" },
  { href: "/admin/posts", label: "Journal" },
  { href: "/admin/reviews", label: "Avis" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/mail-preview", label: "Email" },
  { href: "/admin/agents", label: "Agents IA" },
  { href: "/admin/settings", label: "Paramètres" },
  { href: "/admin/design", label: "Design" },
  { href: "/admin/account", label: "Compte" },
];

function linkActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

const COLLAPSE_KEY = "rp_admin_collapsed";

export default function AdminShell({ unread, profile, children }: Props) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Load collapse preference once
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  // Persist collapse
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll while mobile drawer open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className={`admin-shell ${collapsed ? "is-collapsed" : ""}`}>
      {/* Mobile top bar */}
      <div className="admin-topbar">
        <button
          type="button"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="admin-burger"
        >
          <span className={`burger-line ${mobileOpen ? "x1" : ""}`} />
          <span className={`burger-line ${mobileOpen ? "x2" : ""}`} />
          <span className={`burger-line ${mobileOpen ? "x3" : ""}`} />
        </button>
        <span className="serif" style={{ fontSize: 18, color: "var(--gold-light)", letterSpacing: ".04em" }}>
          Romero Admin
        </span>
        <Link href="/" target="_blank" className="cap-tracked-sm gold" style={{ marginLeft: "auto" }}>
          Site ↗
        </Link>
      </div>

      <div className={`admin-drawer-scrim ${mobileOpen ? "open" : ""}`} onClick={() => setMobileOpen(false)} />

      <aside className={`admin-side ${mobileOpen ? "open" : ""}`}>
        <div className="admin-side-header">
          <h1>{collapsed ? "R" : "Romero Admin"}</h1>
          <button
            type="button"
            className="admin-collapse-btn"
            aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
            title={collapsed ? "Déplier" : "Replier"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        <nav className="admin-side-nav">
          {LINKS.map((l) => {
            const active = linkActive(pathname, l.href);
            const showBadge =
              (l.href === "/admin/messages" || l.href === "/admin/inbox") && unread > 0;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "active" : ""}
                title={collapsed ? l.label : undefined}
              >
                <span className="admin-side-label">{collapsed ? l.label.charAt(0) : l.label}</span>
                {showBadge && <span className="badge">{unread}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="spacer" />

        {profile ? (
          <div
            title={`${profile.name} · ${profile.email}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "8px 0" : "10px 12px",
              marginBottom: 8,
              borderTop: "1px solid rgba(184,151,90,0.15)",
              borderBottom: "1px solid rgba(184,151,90,0.15)",
              overflow: "hidden",
            }}
          >
            {profile.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.picture}
                alt=""
                referrerPolicy="no-referrer"
                width={collapsed ? 24 : 28}
                height={collapsed ? 24 : 28}
                style={{ borderRadius: "50%", flexShrink: 0 }}
              />
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  width: collapsed ? 24 : 28,
                  height: collapsed ? 24 : 28,
                  borderRadius: "50%",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(184,151,90,0.25)",
                  color: "var(--gold-light)",
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {profile.name.charAt(0).toUpperCase()}
              </span>
            )}
            {!collapsed ? (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--gold-light)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontWeight: 500,
                  }}
                >
                  {profile.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(244,239,227,0.55)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {profile.email}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <Link href="/" target="_blank" style={{ color: "var(--gold-light)" }} title="Voir le site">
          {collapsed ? "↗" : "Voir le site ↗"}
        </Link>
        <form method="post" action="/api/auth/logout">
          <button type="submit" title="Déconnexion">
            {collapsed ? "⎋" : "Déconnexion"}
          </button>
        </form>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
