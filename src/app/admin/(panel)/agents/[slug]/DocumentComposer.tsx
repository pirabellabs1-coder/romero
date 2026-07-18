"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDocumentAction, extractDocumentAction } from "../admin-actions";

type Kind = "quote" | "contract" | "invoice";
type Props = { kind: Kind; title: string; singular: string };

const PLACEHOLDERS: Record<Kind, string> = {
  quote:
    "Ex : Devis pour Sophie et Marc, mariage le 12 juin 2027 à Antibes, environ 120 invités, formule Grand Classique.",
  contract:
    "Ex : Contrat pour Sophie et Marc, mariage le 12 juin 2027 à la Villa Belrose, Grand Classique, 3200 €, acompte 30 %.",
  invoice:
    "Ex : Facture Sophie et Marc, solde après acompte de 960 €, échéance 30 jours.",
};

export default function DocumentComposer({ kind, title, singular }: Props) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [editableJson, setEditableJson] = useState("");

  async function extract() {
    if (!brief.trim()) {
      setFlash({ ok: false, msg: "Écrivez d'abord un brief." });
      return;
    }
    setFlash(null);
    startTransition(async () => {
      const r = await extractDocumentAction({ kind, brief: brief.trim() });
      if (!r.ok) {
        setFlash({ ok: false, msg: r.error });
        return;
      }
      setPreview(r.extraction);
      setEditableJson(JSON.stringify(r.extraction, null, 2));
      setFlash({
        ok: true,
        msg: "Structure extraite — vérifiez et éditez si besoin avant de générer.",
      });
    });
  }

  async function generate() {
    if (!editableJson.trim()) {
      setFlash({ ok: false, msg: "Extrayez d'abord la structure." });
      return;
    }
    setFlash(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editableJson);
    } catch (e) {
      setFlash({
        ok: false,
        msg: `JSON invalide : ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }
    startTransition(async () => {
      const r = await createDocumentAction({ kind, data: parsed });
      if (!r.ok) {
        setFlash({ ok: false, msg: r.error });
        return;
      }
      setFlash({
        ok: true,
        msg: `${singular.charAt(0).toUpperCase() + singular.slice(1)} ${r.reference} créé — PDF disponible.`,
      });
      setBrief("");
      setPreview(null);
      setEditableJson("");
      router.refresh();
    });
  }

  return (
    <div className="agent-panel" style={{ marginBottom: 22 }}>
      <h2>Nouveau {singular}</h2>
      <p style={{ marginTop: -6, marginBottom: 22 }}>
        Décrivez le {singular} en une phrase — l'agent extrait la structure et
        prépare le PDF. Vérifiez et éditez avant génération.
      </p>

      {flash ? (
        <div className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}>
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      <div className="agent-form-field">
        <label htmlFor="brief">Brief</label>
        <textarea
          id="brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={PLACEHOLDERS[kind]}
          style={{ minHeight: 100 }}
          disabled={pending}
        />
      </div>

      <div className="agent-actions">
        <button
          type="button"
          className="agent-btn agent-btn--ghost"
          onClick={extract}
          disabled={pending || !brief.trim()}
        >
          {pending && !preview ? "Extraction…" : "1. Extraire la structure"}
        </button>
        {preview ? (
          <button
            type="button"
            className="agent-btn agent-btn--primary"
            onClick={generate}
            disabled={pending}
          >
            {pending ? "Génération…" : `2. Générer le ${singular} + PDF`}
          </button>
        ) : null}
      </div>

      {preview ? (
        <div className="agent-form-field" style={{ marginTop: 20 }}>
          <label>Structure éditable (JSON)</label>
          <textarea
            value={editableJson}
            onChange={(e) => setEditableJson(e.target.value)}
            style={{
              minHeight: 380,
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          />
          <span className="agent-form-field__help">
            Ce JSON contient tous les champs qui apparaîtront sur le PDF. Vous
            pouvez modifier n'importe quoi avant de générer.
          </span>
        </div>
      ) : null}
    </div>
  );
}
