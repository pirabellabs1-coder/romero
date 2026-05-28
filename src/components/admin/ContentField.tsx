"use client";
import { useState, useRef } from "react";

type Lang = "fr" | "en";
type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Props = {
  page: string;
  fieldKey: string;
  label: string;
  /** Whether the input renders as a single-line input or multi-line textarea. */
  variant?: "input" | "textarea";
  /** Current value in DB (override) if any. */
  initialFr: string;
  initialEn: string;
  /** Fallback default (the i18n hardcoded string). Shown greyed when no override. */
  defaultFr: string;
  defaultEn: string;
  /** Optional helper text below the label. */
  hint?: string;
  saveAction: (
    page: string,
    key: string,
    lang: Lang,
    value: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Inline editor for a single i18n field.
 *
 *   ┌─ Label ────────────────────────────────┐
 *   │ [ FR input          ] [ ✓ saved ]      │
 *   │ [ EN input          ]                  │
 *   │ hint (optional)                        │
 *   └────────────────────────────────────────┘
 *
 * - Saves on blur (no manual ENREGISTRER button needed).
 * - Per-language status indicator.
 * - Clearing the input restores the i18n factory default.
 */
export default function ContentField({
  page,
  fieldKey,
  label,
  variant = "input",
  initialFr,
  initialEn,
  defaultFr,
  defaultEn,
  hint,
  saveAction,
}: Props) {
  const [fr, setFr] = useState(initialFr);
  const [en, setEn] = useState(initialEn);
  // Track which version was last persisted, so blur doesn't fire a
  // save when nothing has actually changed.
  const lastSavedRef = useRef({ fr: initialFr, en: initialEn });
  const [status, setStatus] = useState<{ fr: Status; en: Status }>({
    fr: { kind: "idle" },
    en: { kind: "idle" },
  });

  async function save(lang: Lang) {
    const value = lang === "fr" ? fr : en;
    if (value === lastSavedRef.current[lang]) return;
    setStatus((s) => ({ ...s, [lang]: { kind: "saving" } }));
    const res = await saveAction(page, fieldKey, lang, value);
    lastSavedRef.current[lang] = value;
    if (res.ok) {
      setStatus((s) => ({ ...s, [lang]: { kind: "saved" } }));
      setTimeout(() => {
        setStatus((s) =>
          s[lang].kind === "saved" ? { ...s, [lang]: { kind: "idle" } } : s
        );
      }, 1600);
    } else {
      setStatus((s) => ({ ...s, [lang]: { kind: "error", message: res.error } }));
    }
  }

  function renderInput(lang: Lang, value: string, setter: (v: string) => void, placeholder: string) {
    const common = {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setter(e.target.value),
      onBlur: () => save(lang),
      placeholder,
      className: variant === "textarea" ? "admin-textarea" : "admin-input",
    };
    return variant === "textarea" ? (
      <textarea {...common} rows={3} style={{ minHeight: 72 }} />
    ) : (
      <input {...common} type="text" />
    );
  }

  function pill(s: Status) {
    switch (s.kind) {
      case "idle": return null;
      case "saving": return <span style={{ fontSize: 11, color: "var(--muted)" }}>Enregistrement…</span>;
      case "saved": return <span style={{ fontSize: 11, color: "var(--sage-deep)" }}>✓ Enregistré</span>;
      case "error": return <span style={{ fontSize: 11, color: "#8B2E2E" }}>❌ {s.message}</span>;
    }
  }

  const frEmpty = fr.trim() === "";
  const enEmpty = en.trim() === "";

  return (
    <div className="content-field">
      <div className="content-field__head">
        <label className="admin-label">{label}</label>
      </div>
      <div className="content-field__bilingual">
        <div className="content-field__col">
          <div className="content-field__col-head">
            <span className="cap-tracked-sm gold">FR</span>
            {pill(status.fr)}
          </div>
          {renderInput("fr", fr, setFr, frEmpty ? defaultFr : "")}
          {frEmpty && (
            <p className="content-field__default">↳ Affichera la valeur par défaut : <em>« {defaultFr} »</em></p>
          )}
        </div>
        <div className="content-field__col">
          <div className="content-field__col-head">
            <span className="cap-tracked-sm gold">EN</span>
            {pill(status.en)}
          </div>
          {renderInput("en", en, setEn, enEmpty ? defaultEn : "")}
          {enEmpty && (
            <p className="content-field__default">↳ Defaults to: <em>« {defaultEn} »</em></p>
          )}
        </div>
      </div>
      {hint && <p className="content-field__hint">{hint}</p>}
    </div>
  );
}
