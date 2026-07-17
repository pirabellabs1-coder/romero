"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAgentPrompt } from "../actions";

type Props = {
  slug: string;
  current: string;
  isDefault: boolean;
  defaultPrompt: string;
};

export default function PromptEditor({
  slug,
  current,
  isDefault,
  defaultPrompt,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  function onSave() {
    setFlash(null);
    startTransition(async () => {
      const res = await saveAgentPrompt(slug, value);
      if (res.ok) {
        setFlash({ ok: true, msg: "Prompt enregistré." });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: res.error });
      }
    });
  }

  function onResetDefault() {
    if (
      confirm(
        "Remettre le prompt par défaut ? Vos personnalisations seront perdues."
      )
    ) {
      setValue(defaultPrompt);
    }
  }

  return (
    <div className="agent-detail">
      <div className="agent-panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Prompt système — instructions permanentes de l'agent</h2>
        <p style={{ marginTop: -6 }}>
          Ce texte est envoyé à Claude à chaque appel. C'est le « caractère »
          de votre agent : son rôle, son ton, ses limites. Prenez le temps de
          le rédiger — c'est ce qui fait 80 % de la qualité des réponses.
        </p>

        {isDefault ? (
          <div className="agent-flash agent-flash--ok" style={{ marginBottom: 16 }}>
            Vous utilisez actuellement le <strong>prompt par défaut</strong> —
            fonctionnel, mais gagnera beaucoup à être personnalisé avec votre voix
            et vos spécificités.
          </div>
        ) : null}

        {flash ? (
          <div
            className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
            role="status"
          >
            {flash.ok ? "✓" : "✗"} {flash.msg}
          </div>
        ) : null}

        <div className="agent-form-field">
          <label htmlFor="prompt">Prompt système</label>
          <textarea
            id="prompt"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ minHeight: 480, fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13, lineHeight: 1.55 }}
          />
          <span className="agent-form-field__help">
            {value.length.toLocaleString("fr-FR")} caractères ·{" "}
            {Math.ceil(value.length / 4).toLocaleString("fr-FR")} tokens estimés
          </span>
        </div>

        <div className="agent-actions">
          <button
            type="button"
            className="agent-btn agent-btn--primary"
            onClick={onSave}
            disabled={pending}
          >
            {pending ? "Enregistrement…" : "Enregistrer le prompt"}
          </button>
          <button
            type="button"
            className="agent-btn agent-btn--ghost"
            onClick={onResetDefault}
            disabled={pending}
          >
            Réinitialiser au défaut
          </button>
        </div>
      </div>
    </div>
  );
}
