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
};

export default function AgentConfigForm({ slug, fields, current }: Props) {
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

      {fields.map((f) => (
        <div key={f.key} className="agent-form-field">
          <label htmlFor={`f-${f.key}`}>
            {f.label}
            {f.required ? " *" : ""}
          </label>
          {f.type === "textarea" ? (
            <textarea
              id={`f-${f.key}`}
              name={f.key}
              defaultValue={current[f.key] ?? ""}
              placeholder={f.placeholder}
            />
          ) : (
            <input
              id={`f-${f.key}`}
              name={f.key}
              type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"}
              defaultValue={current[f.key] ?? ""}
              placeholder={f.placeholder}
              autoComplete={f.type === "password" ? "new-password" : "off"}
            />
          )}
          {f.help ? <span className="agent-form-field__help">{f.help}</span> : null}
        </div>
      ))}

      <div className="agent-actions">
        <button type="submit" className="agent-btn agent-btn--primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
