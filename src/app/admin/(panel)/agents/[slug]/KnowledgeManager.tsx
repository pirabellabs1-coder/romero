"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addKnowledgeEntry,
  deleteKnowledgeEntry,
  seedKnowledgeAction,
  updateKnowledgeEntry,
} from "../actions";
import type { AgentKnowledgeEntry } from "@/lib/agents";

type Props = {
  slug: string;
  entries: AgentKnowledgeEntry[];
};

const DEFAULT_CATEGORIES = [
  "general",
  "prestations",
  "tarifs",
  "faq",
  "style",
  "cgv",
  "modeles",
];

export default function KnowledgeManager({ slug, entries }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<number | null>(null);
  // On n'ouvre PAS le formulaire d'ajout par défaut : sinon quand la
  // KB est vide, le bouton « Importer le pack de démarrage » est caché
  // sous le formulaire, et le photographe ne comprend pas comment
  // amorcer sa base rapidement.
  const [showAdd, setShowAdd] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setFlash(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setFlash({ ok: true, msg: okMsg });
        setEditing(null);
        setShowAdd(false);
        router.refresh();
      } else if ("error" in res) {
        setFlash({ ok: false, msg: res.error ?? "Erreur inconnue" });
      }
    });
  }

  return (
    <div className="agent-detail">
      <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Base de connaissances</h2>
        <p style={{ marginTop: -6 }}>
          Chaque entrée est un fait, un extrait de FAQ, une politique. L'agent
          y accède à chaque conversation pour répondre avec précision. Plus la
          KB est riche et précise, meilleures sont les réponses.
        </p>

        {flash ? (
          <div
            className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
            role="status"
          >
            {flash.ok ? "✓" : "✗"} {flash.msg}
          </div>
        ) : null}

        {/* Liste des entrées */}
        {entries.length === 0 ? (
          <p style={{ opacity: 0.55, fontStyle: "italic" }}>
            Aucune connaissance ajoutée pour l'instant.
          </p>
        ) : (
          <div className="agent-kb-list">
            {entries.map((e) => (
              <div key={e.id} className="agent-kb-item">
                {editing === e.id ? (
                  <EditRow
                    entry={e}
                    onCancel={() => setEditing(null)}
                    onSave={(patch) =>
                      run(
                        () => updateKnowledgeEntry(slug, e.id, patch),
                        "Entrée mise à jour."
                      )
                    }
                    pending={pending}
                  />
                ) : (
                  <>
                    <div className="agent-kb-item__head">
                      <span className="agent-kb-item__cat">{e.category}</span>
                      <strong>{e.title}</strong>
                      <div className="agent-kb-item__actions">
                        <button
                          type="button"
                          className="agent-btn agent-btn--ghost"
                          onClick={() => setEditing(e.id)}
                          style={{ fontSize: 10, padding: "6px 10px" }}
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          className="agent-btn agent-btn--danger"
                          onClick={() => {
                            if (confirm(`Supprimer « ${e.title} » ?`)) {
                              run(
                                () => deleteKnowledgeEntry(slug, e.id),
                                "Entrée supprimée."
                              );
                            }
                          }}
                          style={{ fontSize: 10, padding: "6px 10px" }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                    <div className="agent-kb-item__body">{e.content}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Formulaire d'ajout */}
        {showAdd ? (
          <AddForm
            onCancel={() => setShowAdd(false)}
            onAdd={(entry) =>
              run(() => addKnowledgeEntry(slug, entry), "Entrée ajoutée.")
            }
            pending={pending}
          />
        ) : (
          <div className="agent-actions">
            <button
              type="button"
              className="agent-btn agent-btn--primary"
              onClick={() => setShowAdd(true)}
            >
              + Ajouter une entrée
            </button>
            <button
              type="button"
              className="agent-btn agent-btn--ghost"
              onClick={() => {
                setFlash(null);
                startTransition(async () => {
                  const res = await seedKnowledgeAction(slug);
                  if (res.ok) {
                    setFlash({
                      ok: true,
                      msg: `Seed appliqué : ${res.created} nouvelle(s) fiche(s) ajoutée(s), ${res.skipped} déjà présente(s).`,
                    });
                    router.refresh();
                  } else if ("error" in res) {
                    setFlash({ ok: false, msg: res.error ?? "" });
                  }
                });
              }}
              disabled={pending}
            >
              📚 Importer le pack de démarrage
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddForm({
  onCancel,
  onAdd,
  pending,
}: {
  onCancel: () => void;
  onAdd: (entry: { title: string; content: string; category: string }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  return (
    <div style={{ marginTop: 22, padding: 20, background: "rgba(0,0,0,0.18)", border: "1px solid rgba(184,151,90,0.22)", borderRadius: 6 }}>
      <div className="agent-form-field">
        <label htmlFor="k-title">Titre</label>
        <input
          id="k-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Prix moyen d'une formule Prestige"
        />
      </div>
      <div className="agent-form-field">
        <label htmlFor="k-cat">Catégorie</label>
        <input
          id="k-cat"
          list="k-cat-list"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="k-cat-list">
          {DEFAULT_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="agent-form-field">
        <label htmlFor="k-content">Contenu</label>
        <textarea
          id="k-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Contenu détaillé — sera injecté dans le prompt de l'agent"
          style={{ minHeight: 140 }}
        />
      </div>
      <div className="agent-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="agent-btn agent-btn--primary"
          onClick={() => onAdd({ title, content, category })}
          disabled={pending || !title.trim() || !content.trim()}
        >
          {pending ? "…" : "Ajouter"}
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

function EditRow({
  entry,
  onCancel,
  onSave,
  pending,
}: {
  entry: AgentKnowledgeEntry;
  onCancel: () => void;
  onSave: (patch: { title: string; content: string; category: string }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [category, setCategory] = useState(entry.category);
  return (
    <>
      <div className="agent-form-field">
        <label>Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="agent-form-field">
        <label>Catégorie</label>
        <input value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="agent-form-field">
        <label>Contenu</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ minHeight: 140 }}
        />
      </div>
      <div className="agent-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="agent-btn agent-btn--primary"
          onClick={() => onSave({ title, content, category })}
          disabled={pending}
        >
          Enregistrer
        </button>
        <button
          type="button"
          className="agent-btn agent-btn--ghost"
          onClick={onCancel}
        >
          Annuler
        </button>
      </div>
    </>
  );
}
