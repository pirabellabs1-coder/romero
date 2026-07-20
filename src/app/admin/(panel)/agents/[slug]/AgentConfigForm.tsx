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

      {fields.map((f) => {
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
      })}

      <div className="agent-actions">
        <button type="submit" className="agent-btn agent-btn--primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
