"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

type Lang = "fr" | "en";
type ContentEdit = { key: string; lang: Lang; value: string };

export type FieldSpec = {
  key: string;
  label: string;
  variant?: "input" | "textarea";
  hint?: string;
};
export type SectionSpec = {
  title: string;
  description?: string;
  fields: FieldSpec[];
};

type Props = {
  page: string;
  viewPath: string;
  sections: SectionSpec[];
  initialFr: Record<string, string>;
  initialEn: Record<string, string>;
  defaultsFr: Record<string, string>;
  defaultsEn: Record<string, string>;
  saveAction: (
    page: string,
    edits: ContentEdit[]
  ) => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
};

/**
 * Generic FR/EN content editor for any page. Same UX as the home
 * editor — pre-filled inputs, blur autosave, language switch,
 * sticky save bar — but driven by a config (sections + fields)
 * instead of being hardcoded for the home layout.
 *
 * Use this for the "structural" pages (About, Services, Portfolio
 * intro, Blog intro, Reviews intro, Contact, Nav, Footer). The home
 * keeps its own visual editor because it has more bespoke widgets
 * (hero photo uploader, featured galleries preview).
 */
function resolved(overrides: Record<string, string>, defaults: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...defaults };
  for (const [k, v] of Object.entries(overrides)) {
    if (v != null) out[k] = v;
  }
  return out;
}

export default function PageContentEditor({
  page, viewPath, sections,
  initialFr, initialEn, defaultsFr, defaultsEn,
  saveAction,
}: Props) {
  const [lang, setLang] = useState<Lang>("fr");
  const [fr, setFr] = useState<Record<string, string>>(() => resolved(initialFr, defaultsFr));
  const [en, setEn] = useState<Record<string, string>>(() => resolved(initialEn, defaultsEn));
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; count: number }
    | { kind: "err"; message: string }
  >({ kind: "idle" });
  const [baselineFr] = useState(() => resolved(initialFr, defaultsFr));
  const [baselineEn] = useState(() => resolved(initialEn, defaultsEn));

  type FieldStatus = "idle" | "saving" | "saved" | { error: string };
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({});
  function setOneStatus(stKey: string, s: FieldStatus) {
    setFieldStatus((p) => ({ ...p, [stKey]: s }));
    if (s === "saved") {
      setTimeout(() => {
        setFieldStatus((p) => (p[stKey] === "saved" ? { ...p, [stKey]: "idle" } : p));
      }, 1800);
    }
  }

  const dirtyKeys = useMemo(() => {
    const out: ContentEdit[] = [];
    const keys = new Set([
      ...Object.keys(fr), ...Object.keys(baselineFr),
      ...Object.keys(en), ...Object.keys(baselineEn),
    ]);
    for (const k of keys) {
      if ((fr[k] ?? "") !== (baselineFr[k] ?? "")) {
        const v = fr[k] === defaultsFr[k] ? "" : fr[k];
        out.push({ key: k, lang: "fr", value: v ?? "" });
      }
      if ((en[k] ?? "") !== (baselineEn[k] ?? "")) {
        const v = en[k] === defaultsEn[k] ? "" : en[k];
        out.push({ key: k, lang: "en", value: v ?? "" });
      }
    }
    return out;
  }, [fr, en, baselineFr, baselineEn, defaultsFr, defaultsEn]);
  const dirty = dirtyKeys.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function setVal(key: string, value: string) {
    if (lang === "fr") setFr((p) => ({ ...p, [key]: value }));
    else setEn((p) => ({ ...p, [key]: value }));
  }
  function getVal(key: string): string {
    return (lang === "fr" ? fr[key] : en[key]) ?? "";
  }
  function getDefault(key: string): string {
    return (lang === "fr" ? defaultsFr[key] : defaultsEn[key]) ?? "";
  }
  function isFieldDirty(key: string): boolean {
    const cur = lang === "fr" ? fr[key] ?? "" : en[key] ?? "";
    const init = lang === "fr" ? baselineFr[key] ?? "" : baselineEn[key] ?? "";
    return cur !== init;
  }

  async function autoSaveField(key: string) {
    const cur = lang === "fr" ? fr[key] ?? "" : en[key] ?? "";
    const base = lang === "fr" ? baselineFr[key] ?? "" : baselineEn[key] ?? "";
    if (cur === base) return;
    const stKey = `${key}:${lang}`;
    setOneStatus(stKey, "saving");
    const def = lang === "fr" ? defaultsFr[key] ?? "" : defaultsEn[key] ?? "";
    const payload = cur === def ? "" : cur;
    const res = await saveAction(page, [{ key, lang, value: payload }]);
    if (res.ok) {
      if (lang === "fr") baselineFr[key] = cur;
      else baselineEn[key] = cur;
      setOneStatus(stKey, "saved");
    } else {
      setOneStatus(stKey, { error: res.error });
    }
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveStatus({ kind: "idle" });
    const res = await saveAction(page, dirtyKeys);
    setSaving(false);
    if (res.ok) {
      Object.assign(baselineFr, fr);
      Object.assign(baselineEn, en);
      setSaveStatus({ kind: "ok", count: res.count });
      setTimeout(() => setSaveStatus({ kind: "idle" }), 3500);
    } else {
      setSaveStatus({ kind: "err", message: res.error });
    }
  }

  function renderField(f: FieldSpec) {
    const val = getVal(f.key);
    const def = getDefault(f.key);
    const isDirty = isFieldDirty(f.key);
    const stKey = `${f.key}:${lang}`;
    const st = fieldStatus[stKey];
    const inputProps = {
      value: val,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(f.key, e.target.value),
      onBlur: () => autoSaveField(f.key),
      placeholder: val.trim() === "" ? def : "",
      className: f.variant === "textarea" ? "admin-textarea" : "admin-input",
    };
    let pill: { text: string; color: string } | null = null;
    if (st === "saving") pill = { text: "Enregistrement…", color: "var(--muted)" };
    else if (st === "saved") pill = { text: "✓ Enregistré", color: "var(--sage-deep)" };
    else if (st && typeof st === "object" && "error" in st) pill = { text: `❌ ${st.error}`, color: "#8B2E2E" };
    else if (isDirty) pill = { text: "Modifié — non enregistré", color: "var(--gold-deep)" };
    return (
      <div className={`content-field${isDirty ? " is-dirty" : ""}`} key={f.key + lang}>
        <div className="content-field__head">
          <label className="admin-label">{f.label}</label>
          {pill && (
            <span style={{ color: pill.color, fontSize: 11, fontWeight: 500 }}>{pill.text}</span>
          )}
        </div>
        {f.variant === "textarea"
          ? <textarea {...inputProps} rows={3} style={{ minHeight: 72 }} />
          : <input {...inputProps} type="text" />}
        {val !== def && (
          <p className="content-field__default">
            ↳ Texte par défaut : <em>« {def} »</em>{" "}
            <button
              type="button"
              onClick={() => {
                setVal(f.key, def);
                setTimeout(() => autoSaveField(f.key), 0);
              }}
              style={{ background: "transparent", border: 0, color: "var(--gold-deep)", cursor: "pointer", fontSize: 11, textDecoration: "underline", padding: 0, marginLeft: 6 }}
            >
              ↻ Réinitialiser
            </button>
          </p>
        )}
        {f.hint && <p className="content-field__hint">{f.hint}</p>}
      </div>
    );
  }

  return (
    <div className="content-editor">
      <div className="content-editor__topbar">
        <div className="content-editor__langs">
          <button type="button" className={`content-editor__lang-btn${lang === "fr" ? " is-active" : ""}`} onClick={() => setLang("fr")}>🇫🇷 Français</button>
          <button type="button" className={`content-editor__lang-btn${lang === "en" ? " is-active" : ""}`} onClick={() => setLang("en")}>🇬🇧 English</button>
        </div>
        <Link href={viewPath} target="_blank" className="admin-btn ghost" style={{ fontSize: 11 }}>
          VOIR LA PAGE ↗
        </Link>
      </div>

      <p className="admin-sub" style={{ marginTop: 0, marginBottom: 18 }}>
        Vous éditez actuellement la version <b style={{ color: "var(--gold-deep)" }}>{lang === "fr" ? "française" : "anglaise"}</b>.
      </p>

      {sections.map((section) => (
        <div key={section.title} className="admin-card">
          <div className="content-section-head">
            <h2>{section.title}</h2>
            {section.description && <p>{section.description}</p>}
          </div>
          {section.fields.map(renderField)}
        </div>
      ))}

      {/* Sticky save bar */}
      <div className={`content-editor__savebar${dirty ? " is-dirty" : ""}`}>
        <div className="content-editor__savebar-inner">
          <div className="content-editor__savebar-status">
            {saveStatus.kind === "ok" && (
              <span style={{ color: "var(--sage-deep)" }}>
                ✓ {saveStatus.count} champ{saveStatus.count > 1 ? "s" : ""} enregistré{saveStatus.count > 1 ? "s" : ""}
              </span>
            )}
            {saveStatus.kind === "err" && <span style={{ color: "#8B2E2E" }}>❌ {saveStatus.message}</span>}
            {saveStatus.kind === "idle" && dirty && (
              <span style={{ color: "var(--gold-deep)" }}>
                {dirtyKeys.length} modification{dirtyKeys.length > 1 ? "s" : ""} non enregistrée{dirtyKeys.length > 1 ? "s" : ""}
              </span>
            )}
            {saveStatus.kind === "idle" && !dirty && <span style={{ color: "var(--muted)" }}>Aucune modification en attente.</span>}
          </div>
          <button
            type="button"
            className="admin-btn"
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{ opacity: !dirty || saving ? 0.5 : 1 }}
          >
            {saving ? "Enregistrement…" : "ENREGISTRER"}
          </button>
        </div>
      </div>
    </div>
  );
}
