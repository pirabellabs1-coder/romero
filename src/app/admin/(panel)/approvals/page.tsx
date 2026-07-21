/**
 * Vue admin des approvals (drafts IA en attente / traitées)
 * ────────────────────────────────────────────────────────
 * Liste tous les pending_approvals avec leur statut. Permet à Mickael
 * de valider/rejeter manuellement si Telegram n'a pas fonctionné, ou
 * de consulter l'historique des envois.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { query } from "@/lib/db";
import ApprovalsList, { type ApprovalRow } from "./ApprovalsList";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Réponses IA — Romero Photography",
};

export default async function ApprovalsPage() {
  const rows = await query<ApprovalRow>(
    `SELECT id, source, source_id, contact_name, contact_email,
            original_message, contact_meta, draft_response, sent_response,
            language, status, telegram_message_id,
            decided_at, sent_at, created_at
     FROM pending_approvals
     ORDER BY created_at DESC
     LIMIT 100`
  ).catch(() => []);

  const pending = rows.filter((r) => r.status === "pending").length;
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "sent_failed").length;
  const rejected = rows.filter((r) => r.status === "rejected").length;

  return (
    <div>
      <Link href="/admin/inbox" className="agent-back">
        ← Retour à l'inbox
      </Link>

      <section className="agents-hero" style={{ marginBottom: 22 }}>
        <div className="agents-hero__eyebrow">Flow validation IA</div>
        <h1 className="agents-hero__title">
          Réponses <em>en attente & envoyées</em>
        </h1>
        <p className="agents-hero__lead">
          Chaque nouveau contact déclenche automatiquement un brouillon IA envoyé sur ton Telegram.
          Retrouve ici l'historique et intervient manuellement si besoin.
        </p>
      </section>

      {/* Résumé */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <StatCard label="En attente" value={pending} color="#B8975A" />
        <StatCard label="Envoyées" value={sent} color="#9DCE9D" />
        <StatCard label="Échouées" value={failed} color="#E48A8A" />
        <StatCard label="Ignorées" value={rejected} color="rgba(244,239,227,0.5)" />
      </div>

      <ApprovalsList rows={rows} />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="agent-panel"
      style={{
        padding: "14px 16px",
        borderLeft: `3px solid ${color}`,
        margin: 0,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 300, color }}>{value}</div>
      <div
        style={{
          fontSize: 10,
          opacity: 0.6,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
