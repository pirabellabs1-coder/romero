"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manualApprovalAction } from "./actions";

export type ApprovalRow = {
  id: number;
  source: string;
  source_id: number | null;
  contact_name: string;
  contact_email: string;
  original_message: string;
  contact_meta: string;
  draft_response: string;
  sent_response: string | null;
  language: string;
  status: string;
  telegram_message_id: number | null;
  decided_at: string | null;
  sent_at: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "#B8975A" },
  sent: { label: "Envoyé", color: "#9DCE9D" },
  sent_failed: { label: "Échec envoi", color: "#E48A8A" },
  rejected: { label: "Ignoré", color: "rgba(244,239,227,0.5)" },
  edited_pending: { label: "Édition en cours", color: "#B8975A" },
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function ApprovalsList({ rows }: { rows: ApprovalRow[] }) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { k: "all", l: "Tous" },
          { k: "pending", l: "En attente" },
          { k: "sent", l: "Envoyées" },
          { k: "sent_failed", l: "Échouées" },
          { k: "rejected", l: "Ignorées" },
        ].map((f) => (
          <button
            key={f.k}
            type="button"
            onClick={() => setFilter(f.k)}
            className={filter === f.k ? "agent-btn agent-btn--primary" : "agent-btn"}
            style={{ fontSize: 11.5 }}
          >
            {f.l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="agent-panel"
          style={{ textAlign: "center", padding: 40, opacity: 0.55, fontStyle: "italic" }}
        >
          Aucune approval dans ce filtre.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((r) => (
            <ApprovalCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ row }: { row: ApprovalRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const router = useRouter();
  const meta = STATUS_META[row.status] ?? { label: row.status, color: "#999" };
  const isPending = row.status === "pending";

  function act(action: "approve" | "reject") {
    setFlash(null);
    startTransition(async () => {
      const res = await manualApprovalAction(row.id, action);
      if (res.ok) {
        setFlash({ ok: true, msg: action === "approve" ? "Email envoyé au client." : "Rejeté." });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: res.error });
      }
    });
  }

  return (
    <div
      className="agent-panel"
      style={{
        padding: 16,
        borderLeft: `3px solid ${meta.color}`,
        margin: 0,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: 14 }}>{row.contact_name}</strong>
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: meta.color,
                padding: "2px 8px",
                border: `1px solid ${meta.color}44`,
                borderRadius: 3,
              }}
            >
              {meta.label}
            </span>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.65, marginTop: 2 }}>
            {row.contact_email} · {row.source === "contact_form" ? "Formulaire" : row.source} ·{" "}
            {timeAgo(row.created_at)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {isPending ? (
            <>
              <button
                type="button"
                className="agent-btn agent-btn--primary"
                onClick={() => act("approve")}
                disabled={pending}
                style={{ fontSize: 11 }}
              >
                ✓ Envoyer
              </button>
              <button
                type="button"
                className="agent-btn"
                onClick={() => act("reject")}
                disabled={pending}
                style={{ fontSize: 11 }}
              >
                ✗ Ignorer
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="agent-btn"
            onClick={() => setOpen((v) => !v)}
            style={{ fontSize: 11 }}
          >
            {open ? "▴ Fermer" : "▾ Voir"}
          </button>
        </div>
      </div>

      {flash ? (
        <div
          className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
          style={{ marginTop: 10 }}
        >
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      {open ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            background: "rgba(0,0,0,0.15)",
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <Section title="Message du client">
            <pre style={preStyle}>{row.original_message}</pre>
            {row.contact_meta ? (
              <pre style={{ ...preStyle, opacity: 0.7, marginTop: 8, fontSize: 11.5 }}>
                {row.contact_meta}
              </pre>
            ) : null}
          </Section>
          <Section title={row.sent_response ? "Réponse envoyée" : "Brouillon IA"}>
            <pre style={preStyle}>{row.sent_response ?? row.draft_response}</pre>
          </Section>
          {row.sent_at ? (
            <div style={{ fontSize: 11, opacity: 0.6 }}>
              Envoyé le{" "}
              {new Date(row.sent_at).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          opacity: 0.55,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

const preStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  fontSize: 13,
  fontFamily: "inherit",
  lineHeight: 1.6,
  color: "rgba(244,239,227,0.9)",
};
