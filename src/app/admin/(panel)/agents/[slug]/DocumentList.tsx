"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteDocumentAction,
  pushToAccountingAction,
  sendToYousignAction,
  setDocumentStatusAction,
  type AdminDocRow,
} from "../admin-actions";

type Props = {
  docs: AdminDocRow[];
  kind: "quote" | "contract" | "invoice";
  hasYousignKey: boolean;
  hasAccountingKey: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  signed: "Signé",
  paid: "Payé",
  cancelled: "Annulé",
  expired: "Expiré",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "not-installed",
  sent: "installing",
  signed: "installed",
  paid: "installed",
  cancelled: "error",
  expired: "paused",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DocumentList({
  docs,
  kind,
  hasYousignKey,
  hasAccountingKey,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string
  ) {
    setFlash(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setFlash({ ok: true, msg: okMsg });
        router.refresh();
      } else if ("error" in res) {
        setFlash({ ok: false, msg: res.error ?? "Erreur inconnue" });
      }
    });
  }

  if (docs.length === 0) {
    return (
      <div className="agent-panel">
        <p style={{ opacity: 0.6, fontStyle: "italic" }}>
          Aucun document pour l'instant. Créez le premier au-dessus depuis un
          simple brief.
        </p>
      </div>
    );
  }

  return (
    <div className="agent-panel">
      <h2>Documents existants</h2>
      {flash ? (
        <div
          className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
          style={{ marginBottom: 12 }}
        >
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      <table className="agent-stats-table">
        <thead>
          <tr>
            <th>Référence</th>
            <th>Client</th>
            <th>Mariage</th>
            <th style={{ textAlign: "right" }}>Total TTC</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td>
                <code>{d.reference}</code>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>
                  {new Date(d.created_at).toLocaleDateString("fr-FR")}
                </div>
              </td>
              <td>
                <div>{d.client_name}</div>
                {d.client_email ? (
                  <div style={{ fontSize: 11, opacity: 0.65 }}>{d.client_email}</div>
                ) : null}
              </td>
              <td style={{ fontSize: 12 }}>
                {d.wedding_date
                  ? new Date(d.wedding_date).toLocaleDateString("fr-FR")
                  : "—"}
                {d.wedding_location ? (
                  <div style={{ opacity: 0.65 }}>{d.wedding_location}</div>
                ) : null}
              </td>
              <td style={{ textAlign: "right" }}>
                <strong>{formatCents(d.total_cents)} €</strong>
              </td>
              <td>
                <span
                  className={`agent-badge agent-badge--${STATUS_CLASS[d.status] ?? "not-installed"}`}
                  style={{ padding: "3px 8px", fontSize: 9 }}
                >
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </td>
              <td>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {d.pdf_url ? (
                    <a
                      href={d.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="agent-btn agent-btn--ghost"
                      style={{ fontSize: 9, padding: "4px 8px", textDecoration: "none" }}
                    >
                      PDF
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="agent-btn agent-btn--ghost"
                    onClick={() => setOpenId(openId === d.id ? null : d.id)}
                    style={{ fontSize: 9, padding: "4px 8px" }}
                  >
                    {openId === d.id ? "Fermer" : "Détails"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {openId ? (
        <DocumentDetail
          doc={docs.find((d) => d.id === openId)!}
          kind={kind}
          hasYousignKey={hasYousignKey}
          hasAccountingKey={hasAccountingKey}
          pending={pending}
          run={run}
        />
      ) : null}
    </div>
  );
}

function DocumentDetail({
  doc,
  kind,
  hasYousignKey,
  hasAccountingKey,
  pending,
  run,
}: {
  doc: AdminDocRow;
  kind: "quote" | "contract" | "invoice";
  hasYousignKey: boolean;
  hasAccountingKey: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => void;
}) {
  return (
    <div
      style={{
        marginTop: 20,
        padding: 20,
        background: "rgba(0,0,0,0.22)",
        border: "1px solid rgba(184,151,90,0.25)",
        borderRadius: 6,
      }}
    >
      <h2 style={{ marginTop: 0 }}>
        {doc.reference} · {doc.client_name}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <MiniField label="Sous-total HT" value={`${formatCents(doc.subtotal_cents)} €`} />
        <MiniField label="TVA" value={`${formatCents(doc.vat_cents)} €`} />
        <MiniField label="Total TTC" value={`${formatCents(doc.total_cents)} €`} strong />
        <MiniField
          label="Créé le"
          value={new Date(doc.created_at).toLocaleString("fr-FR")}
        />
        {doc.sent_at ? (
          <MiniField
            label="Envoyé le"
            value={new Date(doc.sent_at).toLocaleString("fr-FR")}
          />
        ) : null}
        {doc.yousign_procedure_id ? (
          <MiniField label="Yousign ID" value={doc.yousign_procedure_id} />
        ) : null}
        {doc.accounting_invoice_id ? (
          <MiniField
            label="Compta ID"
            value={`${doc.accounting_provider} · ${doc.accounting_invoice_id}`}
          />
        ) : null}
      </div>

      <div className="agent-actions" style={{ marginTop: 12 }}>
        {/* Signature Yousign (contrat + devis) */}
        {(kind === "contract" || kind === "quote") &&
        doc.status !== "signed" &&
        !doc.yousign_procedure_id ? (
          hasYousignKey && doc.client_email ? (
            <button
              type="button"
              className="agent-btn agent-btn--primary"
              onClick={() =>
                run(
                  () => sendToYousignAction(doc.id),
                  "Envoyé à signer via Yousign."
                )
              }
              disabled={pending}
            >
              Envoyer à signer (Yousign)
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "var(--muted,#7A6E5C)", fontStyle: "italic" }}>
              {!hasYousignKey
                ? "Configurez Yousign pour envoyer à signer"
                : "E-mail client manquant"}
            </span>
          )
        ) : null}

        {/* Comptabilité (facture seulement) */}
        {kind === "invoice" && !doc.accounting_invoice_id ? (
          hasAccountingKey ? (
            <button
              type="button"
              className="agent-btn agent-btn--primary"
              onClick={() =>
                run(
                  () => pushToAccountingAction(doc.id),
                  "Facture synchronisée avec l'outil comptable."
                )
              }
              disabled={pending}
            >
              Envoyer en comptabilité
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "var(--muted,#7A6E5C)", fontStyle: "italic" }}>
              Configurez Pennylane ou Freebe pour synchroniser
            </span>
          )
        ) : null}

        {/* Statut manuel */}
        <select
          value={doc.status}
          onChange={(e) =>
            run(
              () => setDocumentStatusAction(doc.id, e.target.value),
              "Statut mis à jour."
            )
          }
          disabled={pending}
          style={{
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(184,151,90,0.28)",
            color: "#F4EFE3",
            padding: "10px 14px",
            fontSize: 11,
            borderRadius: 3,
            textTransform: "uppercase",
            letterSpacing: "0.16em",
          }}
        >
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="agent-btn agent-btn--danger"
          onClick={() => {
            if (confirm(`Supprimer ${doc.reference} ?`))
              run(
                () => deleteDocumentAction(doc.id),
                "Document supprimé."
              );
          }}
          disabled={pending}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(0,0,0,0.18)",
        borderRadius: 4,
        border: "1px solid rgba(184,151,90,0.15)",
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(244,239,227,0.55)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: strong ? 15 : 13, color: "#F4EFE3", fontWeight: strong ? 600 : 400 }}>
        {value}
      </div>
    </div>
  );
}
