"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SearchHit = {
  kind: "contact" | "lead" | "gallery" | "message" | "approval" | "brief";
  id: number;
  title: string;
  subtitle?: string;
  href: string;
};

const KIND_LABEL: Record<SearchHit["kind"], { label: string; color: string; icon: string }> = {
  contact: { label: "Contact CRM", color: "#9DCE9D", icon: "👤" },
  lead: { label: "Lead chatbot", color: "#9DB29A", icon: "◉" },
  gallery: { label: "Galerie", color: "#B8975A", icon: "🖼" },
  message: { label: "Message contact", color: "#E4C58A", icon: "✉" },
  approval: { label: "Brouillon IA", color: "#E48A8A", icon: "🤖" },
  brief: { label: "Brief marketing", color: "#3EC8F5", icon: "📸" },
};

/**
 * Palette de recherche globale — activée par Cmd/Ctrl+K.
 * Cherche à travers contacts, leads, galleries, messages, approvals.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K global
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    if (!open) {
      setQ("");
      setHits([]);
      setSelected(0);
    }
  }, [open]);

  // Recherche live avec debounce
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/admin/search?q=${encodeURIComponent(q.trim())}`,
          { cache: "no-store" }
        );
        const j = (await r.json()) as { ok: boolean; hits: SearchHit[] };
        if (!cancelled) {
          setHits(j.hits ?? []);
          setSelected(0);
        }
      } catch {
        /* silencieux */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && hits[selected]) {
      e.preventDefault();
      window.location.href = hits[selected].href;
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
        zIndex: 999,
      }}
    >
      <div
        style={{
          width: "min(600px, 92vw)",
          background: "#2E3D2E",
          border: "1px solid rgba(184,151,90,0.3)",
          borderRadius: 8,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
        onKeyDown={onListKey}
      >
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un contact, une galerie, un message…"
          style={{
            width: "100%",
            padding: "16px 20px",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(184,151,90,0.2)",
            color: "rgba(244,239,227,0.95)",
            fontSize: 15,
            outline: "none",
          }}
        />

        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {loading && q.trim().length >= 2 ? (
            <div style={{ padding: 20, opacity: 0.55, textAlign: "center", fontSize: 13 }}>
              Recherche…
            </div>
          ) : q.trim().length < 2 ? (
            <div style={{ padding: 24, opacity: 0.55, textAlign: "center", fontSize: 12.5 }}>
              Tape au moins 2 caractères. Utilise ↑↓ pour naviguer, Entrée pour ouvrir.
              <br />
              Astuce : Cmd/Ctrl+K depuis n'importe où pour ouvrir cette palette.
            </div>
          ) : hits.length === 0 ? (
            <div style={{ padding: 20, opacity: 0.55, textAlign: "center", fontSize: 13 }}>
              Aucun résultat pour « {q} »
            </div>
          ) : (
            hits.map((h, i) => {
              const meta = KIND_LABEL[h.kind];
              const active = i === selected;
              return (
                <Link
                  key={`${h.kind}-${h.id}`}
                  href={h.href}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 20px",
                    borderLeft: `3px solid ${active ? meta.color : "transparent"}`,
                    background: active ? "rgba(184,151,90,0.08)" : "transparent",
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      width: 24,
                      textAlign: "center",
                    }}
                  >
                    {meta.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {h.title}
                    </div>
                    {h.subtitle ? (
                      <div
                        style={{
                          fontSize: 11.5,
                          opacity: 0.6,
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {h.subtitle}
                      </div>
                    ) : null}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: meta.color,
                      padding: "2px 6px",
                      border: `1px solid ${meta.color}`,
                      borderRadius: 3,
                      opacity: 0.85,
                    }}
                  >
                    {meta.label}
                  </span>
                </Link>
              );
            })
          )}
        </div>

        <div
          style={{
            padding: "8px 14px",
            fontSize: 10.5,
            opacity: 0.5,
            borderTop: "1px solid rgba(184,151,90,0.15)",
            display: "flex",
            gap: 14,
            justifyContent: "space-between",
          }}
        >
          <span>↑↓ naviguer · Entrée ouvrir · Échap fermer</span>
          <span>Cmd/Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
