"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createContactAction,
  deleteContactAction,
  syncContactsFromDocumentsAction,
  updateContactAction,
  type AdminContact,
} from "../admin-crm-actions";

type Props = { contacts: AdminContact[] };

export default function AdminContactsView({ contacts }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(contacts.length === 0);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const filtered = q.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          (c.email && c.email.toLowerCase().includes(q.toLowerCase())) ||
          (c.wedding_location &&
            c.wedding_location.toLowerCase().includes(q.toLowerCase()))
      )
    : contacts;

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; created?: number; updated?: number }>,
    okMsg?: (r: { created?: number; updated?: number }) => string
  ) {
    setFlash(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setFlash({
          ok: true,
          msg: okMsg
            ? okMsg(res)
            : "Enregistré.",
        });
        setEditing(null);
        setShowAdd(false);
        router.refresh();
      } else if ("error" in res) {
        setFlash({ ok: false, msg: res.error ?? "Erreur inconnue" });
      }
    });
  }

  return (
    <div>
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Base clients — {contacts.length} contacts</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="agent-btn agent-btn--ghost"
              onClick={() =>
                run(
                  () => syncContactsFromDocumentsAction(),
                  (r) =>
                    `Sync : ${r.created ?? 0} nouveau(x), ${r.updated ?? 0} mis à jour.`
                )
              }
              disabled={pending}
            >
              🔄 Synchroniser depuis les documents
            </button>
            <button
              type="button"
              className="agent-btn agent-btn--primary"
              onClick={() => setShowAdd(!showAdd)}
              disabled={pending}
            >
              {showAdd ? "Annuler" : "+ Nouveau contact"}
            </button>
          </div>
        </div>

        {flash ? (
          <div className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}>
            {flash.ok ? "✓" : "✗"} {flash.msg}
          </div>
        ) : null}

        {/* Recherche */}
        <div className="agent-form-field" style={{ marginBottom: 14 }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom, e-mail ou lieu…"
          />
        </div>

        {/* Formulaire d'ajout */}
        {showAdd ? (
          <ContactForm
            onCancel={() => setShowAdd(false)}
            onSave={(patch) =>
              run(() => createContactAction(patch), () => "Contact ajouté.")
            }
            pending={pending}
          />
        ) : null}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="agent-panel">
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            {contacts.length === 0
              ? "Aucun contact. Utilisez « Synchroniser depuis les documents » pour peupler la base à partir des devis/contrats/factures existants, ou créez le premier contact manuellement."
              : "Aucun résultat pour cette recherche."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((c) =>
            editing === c.id ? (
              <div key={c.id} className="agent-panel">
                <ContactForm
                  initial={c}
                  onCancel={() => setEditing(null)}
                  onSave={(patch) =>
                    run(
                      () => updateContactAction(c.id, patch),
                      () => "Contact mis à jour."
                    )
                  }
                  pending={pending}
                />
              </div>
            ) : (
              <ContactCard
                key={c.id}
                contact={c}
                onEdit={() => setEditing(c.id)}
                onDelete={() => {
                  if (confirm(`Supprimer « ${c.name} » ? (les documents restent intacts)`))
                    run(
                      () => deleteContactAction(c.id),
                      () => "Contact supprimé."
                    );
                }}
                disabled={pending}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function ContactCard({
  contact,
  onEdit,
  onDelete,
  disabled,
}: {
  contact: AdminContact;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const eur = (cents: number) =>
    (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 });
  return (
    <div
      className="agent-panel"
      style={{
        padding: "16px 20px",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <div
            style={{
              fontFamily: "var(--serif, Georgia, serif)",
              fontStyle: "italic",
              fontSize: 18,
              color: "#F4EFE3",
            }}
          >
            {contact.name}
          </div>
          {contact.document_count > 0 ? (
            <span
              className="agent-badge agent-badge--installed"
              style={{ padding: "3px 8px", fontSize: 9 }}
            >
              {contact.document_count} doc{contact.document_count > 1 ? "s" : ""}
            </span>
          ) : null}
          {contact.total_billed_cents > 0 ? (
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#9DCE9D",
              }}
            >
              {eur(contact.total_billed_cents)} € facturés
            </span>
          ) : null}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 8,
            fontSize: 13,
            color: "rgba(244,239,227,0.85)",
          }}
        >
          {contact.email ? <div>✉ {contact.email}</div> : null}
          {contact.phone ? <div>📞 {contact.phone}</div> : null}
          {contact.wedding_date ? (
            <div>
              💍 {new Date(contact.wedding_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          ) : null}
          {contact.wedding_location ? <div>📍 {contact.wedding_location}</div> : null}
        </div>
        {contact.address ? (
          <div style={{ fontSize: 12, color: "rgba(244,239,227,0.6)", marginTop: 6 }}>
            {contact.address}
          </div>
        ) : null}
        {contact.notes ? (
          <div
            style={{
              fontSize: 12.5,
              color: "rgba(244,239,227,0.75)",
              marginTop: 8,
              padding: 8,
              background: "rgba(0,0,0,0.18)",
              borderLeft: "2px solid var(--gold, #B8975A)",
              borderRadius: 2,
              fontStyle: "italic",
              whiteSpace: "pre-wrap",
            }}
          >
            {contact.notes}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          type="button"
          className="agent-btn agent-btn--ghost"
          onClick={onEdit}
          disabled={disabled}
          style={{ fontSize: 10, padding: "6px 10px" }}
        >
          Éditer
        </button>
        <button
          type="button"
          className="agent-btn agent-btn--danger"
          onClick={onDelete}
          disabled={disabled}
          style={{ fontSize: 10, padding: "6px 10px" }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function ContactForm({
  initial,
  onCancel,
  onSave,
  pending,
}: {
  initial?: AdminContact;
  onCancel: () => void;
  onSave: (patch: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    wedding_date?: string;
    wedding_location?: string;
    notes?: string;
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [wDate, setWDate] = useState(initial?.wedding_date?.slice(0, 10) ?? "");
  const [wLoc, setWLoc] = useState(initial?.wedding_location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div
      style={{
        padding: 16,
        background: "rgba(0,0,0,0.18)",
        border: "1px solid rgba(184,151,90,0.22)",
        borderRadius: 6,
        marginTop: initial ? 0 : 12,
      }}
    >
      <div className="agent-form-field">
        <label>Nom du couple ou du contact *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Sophie & Marc Dupont" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div className="agent-form-field">
          <label>E-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sophie@example.com" />
        </div>
        <div className="agent-form-field">
          <label>Téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
        </div>
      </div>
      <div className="agent-form-field">
        <label>Adresse postale</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          placeholder="10 rue de la Paix, 06000 Nice"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div className="agent-form-field">
          <label>Date du mariage</label>
          <input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} />
        </div>
        <div className="agent-form-field">
          <label>Lieu du mariage</label>
          <input value={wLoc} onChange={(e) => setWLoc(e.target.value)} placeholder="Château de la Napoule" />
        </div>
      </div>
      <div className="agent-form-field">
        <label>Notes internes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Ex : préfère les visios en fin de journée, sensible au budget…"
        />
      </div>
      <div className="agent-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="agent-btn agent-btn--primary"
          onClick={() =>
            onSave({
              name,
              email: email || undefined,
              phone: phone || undefined,
              address: address || undefined,
              wedding_date: wDate || undefined,
              wedding_location: wLoc || undefined,
              notes: notes || undefined,
            })
          }
          disabled={pending || !name.trim()}
        >
          {pending ? "…" : initial ? "Enregistrer" : "Ajouter"}
        </button>
        <button
          type="button"
          className="agent-btn agent-btn--ghost"
          onClick={onCancel}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
