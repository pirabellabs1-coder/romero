"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWeddingAction } from "./actions";

/**
 * Modal + bouton pour ajouter rapidement un mariage à venir dans le CRM.
 */
export default function AddWeddingButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFlash(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await addWeddingAction(fd);
      if (res.ok) {
        setFlash({ ok: true, msg: "Mariage ajouté au calendrier." });
        (e.target as HTMLFormElement).reset();
        router.refresh();
        setTimeout(() => setOpen(false), 800);
      } else {
        setFlash({ ok: false, msg: res.error });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="agent-btn agent-btn--primary"
        style={{ marginBottom: 14 }}
      >
        + Ajouter un mariage
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            className="agent-panel"
            style={{
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              margin: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <h2 style={{ margin: 0 }}>Nouveau mariage</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(244,239,227,0.6)",
                  fontSize: 22,
                  cursor: "pointer",
                }}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {flash ? (
              <div
                className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
                style={{ marginBottom: 14 }}
              >
                {flash.ok ? "✓" : "✗"} {flash.msg}
              </div>
            ) : null}

            <form onSubmit={onSubmit}>
              <div className="agent-form-field">
                <label htmlFor="w-name">Nom du couple *</label>
                <input
                  id="w-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Ex : Sophie & Marc Durand"
                  autoFocus
                />
              </div>

              <div className="agent-form-field">
                <label htmlFor="w-date">Date du mariage *</label>
                <input
                  id="w-date"
                  name="wedding_date"
                  type="date"
                  required
                />
              </div>

              <div className="agent-form-field">
                <label htmlFor="w-location">Lieu</label>
                <input
                  id="w-location"
                  name="wedding_location"
                  type="text"
                  placeholder="Ex : Château de la Napoule, Alpes-Maritimes"
                />
              </div>

              <div className="agent-form-field">
                <label htmlFor="w-email">E-mail du couple</label>
                <input
                  id="w-email"
                  name="email"
                  type="email"
                  placeholder="sophie.marc@example.com"
                />
              </div>

              <div className="agent-form-field">
                <label htmlFor="w-phone">Téléphone</label>
                <input
                  id="w-phone"
                  name="phone"
                  type="tel"
                  placeholder="+33 6 xx xx xx xx"
                />
              </div>

              <div className="agent-form-field">
                <label htmlFor="w-notes">Notes internes</label>
                <textarea
                  id="w-notes"
                  name="notes"
                  rows={3}
                  placeholder="Style, contraintes, contexte…"
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  type="submit"
                  className="agent-btn agent-btn--primary"
                  disabled={pending}
                >
                  {pending ? "Enregistrement…" : "Ajouter au calendrier"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="agent-btn"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
