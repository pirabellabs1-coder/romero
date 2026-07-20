"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAgentConfig } from "../actions";

type Field = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "url";
  placeholder?: string;
  help?: string;
  required?: boolean;
  advanced?: boolean;
};

type Props = {
  slug: string;
  fields: Field[];
  current: Record<string, string>;
  /** Config brute stockée par-agent (sans merge Studio). Sert à savoir
   *  quels champs sont hérités vs override localement. */
  rawConfig?: Record<string, unknown>;
  /** Config partagée Studio Settings, utilisée comme placeholder pour
   *  les champs non-override. */
  sharedConfig?: Record<string, string>;
};

export default function AgentConfigForm({
  slug,
  fields,
  current,
  rawConfig,
  sharedConfig,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const simpleFields = fields.filter((f) => !f.advanced);
  const advancedFields = fields.filter((f) => f.advanced);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveAgentConfig(slug, fd);
      if (res.ok) {
        setFlash({ ok: true, msg: "Configuration enregistrée." });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: res.error });
      }
    });
  }

  const renderField = (f: Field) => {
        // Détermine si ce champ est hérité du Studio (valeur partagée
        // présente ET pas d'override local). On affiche alors un badge
        // « hérité de Studio Settings » + placeholder discret.
        const rawVal = rawConfig ? (rawConfig[f.key] as string | undefined) : undefined;
        const sharedVal = sharedConfig?.[f.key];
        const isInheritedOnly =
          (!rawVal || (typeof rawVal === "string" && rawVal.trim() === "")) &&
          typeof sharedVal === "string" && sharedVal.trim().length > 0;
        // defaultValue = uniquement l'override local (permet de « unset » l'override en vidant)
        const localValue = typeof rawVal === "string" ? rawVal : "";
        return (
          <div key={f.key} className="agent-form-field">
            <label htmlFor={`f-${f.key}`}>
              {f.label}
              {f.required ? " *" : ""}
              {isInheritedOnly ? (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 9,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "#9DCE9D",
                    padding: "2px 6px",
                    border: "1px solid rgba(157,206,157,0.4)",
                    borderRadius: 3,
                    verticalAlign: "middle",
                  }}
                >
                  ✓ hérité de Studio Settings
                </span>
              ) : null}
            </label>
            {f.type === "textarea" ? (
              <textarea
                id={`f-${f.key}`}
                name={f.key}
                defaultValue={localValue}
                placeholder={
                  isInheritedOnly
                    ? `(hérité — valeur active : ${sharedVal!.slice(0, 60)}${sharedVal!.length > 60 ? "…" : ""})`
                    : f.placeholder
                }
              />
            ) : (
              <input
                id={`f-${f.key}`}
                name={f.key}
                type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"}
                defaultValue={localValue}
                placeholder={
                  isInheritedOnly
                    ? f.type === "password"
                      ? "(hérité de Studio Settings — masqué)"
                      : `(hérité : ${sharedVal})`
                    : f.placeholder
                }
                autoComplete={f.type === "password" ? "new-password" : "off"}
              />
            )}
            {f.help ? <span className="agent-form-field__help">{f.help}</span> : null}
            {isInheritedOnly ? (
              <span
                className="agent-form-field__help"
                style={{ color: "rgba(157,206,157,0.7)" }}
              >
                Laisser vide = utiliser la valeur du Studio. Remplir = override juste
                pour cet agent.
              </span>
            ) : null}
          </div>
    );
  };

  return (
    <form onSubmit={onSubmit}>
      {flash ? (
        <div
          className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
          role="status"
        >
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      {simpleFields.map(renderField)}

      {advancedFields.length > 0 ? (
        <div style={{ marginTop: 24, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="agent-btn"
            style={{
              width: "100%",
              justifyContent: "flex-start",
              textAlign: "left",
              fontSize: 12.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {showAdvanced ? "▾" : "▸"} Options avancées ({advancedFields.length} champs techniques)
          </button>
          {showAdvanced ? (
            <div
              style={{
                marginTop: 14,
                padding: 16,
                border: "1px solid rgba(184,151,90,0.18)",
                borderRadius: 6,
                background: "rgba(184,151,90,0.03)",
              }}
            >
              <p style={{ fontSize: 12.5, opacity: 0.7, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
                Ces champs sont normalement fournis par la plateforme (Studio Settings,
                ENV, ou OAuth). Ne les remplis que si tu veux override la valeur par
                défaut pour cet agent précis.
              </p>
              {advancedFields.map(renderField)}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="agent-actions">
        <button type="submit" className="agent-btn agent-btn--primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
