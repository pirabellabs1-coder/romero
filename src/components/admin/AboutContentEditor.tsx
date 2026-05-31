"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import HeroPhotoUploader from "@/components/admin/HeroPhotoUploader";

type Lang = "fr" | "en";
type ContentEdit = { key: string; lang: Lang; value: string };

type Props = {
  initialFr: Record<string, string>;
  initialEn: Record<string, string>;
  defaultsFr: Record<string, string>;
  defaultsEn: Record<string, string>;
  eyebrowPhotoUrl: string;
  storyPhotoUrl: string;
  saveAction: (page: string, edits: ContentEdit[]) => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
  saveEyebrowPhotoAction: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveStoryPhotoAction:   (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Visual editor for the About page — mirrors the public layout exactly so
 * the photographer sees each block in its real position. Photos are
 * embedded INSIDE the section where they appear on the public site
 * (not in a separate "Photos" pile at the top).
 *
 * Public structure (top → bottom):
 *   ① Bandeau d'accueil    : texts | photo (right)
 *   ② Mon histoire          : photo | texts (right)
 *   ③ Mes valeurs           : texts only (4 values grid)
 *   ④ Mon processus         : texts only (4 steps)
 *   ⑤ Équipement            : texts only (10 lines)
 */

function resolved(overrides: Record<string, string>, defaults: Record<string, string>) {
  const out: Record<string, string> = { ...defaults };
  for (const [k, v] of Object.entries(overrides)) if (v != null) out[k] = v;
  return out;
}

type FieldStatus = "idle" | "saving" | "saved" | { error: string };

export default function AboutContentEditor({
  initialFr, initialEn, defaultsFr, defaultsEn,
  eyebrowPhotoUrl, storyPhotoUrl,
  saveAction, saveEyebrowPhotoAction, saveStoryPhotoAction,
}: Props) {
  const [lang, setLang] = useState<Lang>("fr");
  const [fr, setFr] = useState(() => resolved(initialFr, defaultsFr));
  const [en, setEn] = useState(() => resolved(initialEn, defaultsEn));
  const [baselineFr] = useState(() => resolved(initialFr, defaultsFr));
  const [baselineEn] = useState(() => resolved(initialEn, defaultsEn));
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    | { kind: "idle" }
    | { kind: "ok"; count: number }
    | { kind: "err"; message: string }
  >({ kind: "idle" });
  const [fieldStatus, setFieldStatus] = useState<Record<string, FieldStatus>>({});

  function setOneStatus(stKey: string, s: FieldStatus) {
    setFieldStatus((p) => ({ ...p, [stKey]: s }));
    if (s === "saved") {
      setTimeout(() => setFieldStatus((p) => (p[stKey] === "saved" ? { ...p, [stKey]: "idle" } : p)), 1800);
    }
  }

  const dirtyKeys = useMemo(() => {
    const out: ContentEdit[] = [];
    const keys = new Set([...Object.keys(fr), ...Object.keys(baselineFr), ...Object.keys(en), ...Object.keys(baselineEn)]);
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
  function getVal(key: string) { return (lang === "fr" ? fr[key] : en[key]) ?? ""; }
  function getDef(key: string) { return (lang === "fr" ? defaultsFr[key] : defaultsEn[key]) ?? ""; }
  function isDirty(key: string) {
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
    const res = await saveAction("about", [{ key, lang, value: payload }]);
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
    const res = await saveAction("about", dirtyKeys);
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

  // ── Generic field renderer (reused across sections) ─────────────
  function field(key: string, label: string, variant: "input" | "textarea" = "input") {
    const val = getVal(key);
    const def = getDef(key);
    const stKey = `${key}:${lang}`;
    const st = fieldStatus[stKey];
    const dirtyHere = isDirty(key);
    const inputProps = {
      value: val,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(key, e.target.value),
      onBlur: () => autoSaveField(key),
      placeholder: val.trim() === "" ? def : "",
      className: variant === "textarea" ? "admin-textarea" : "admin-input",
    };
    let pill: { text: string; color: string } | null = null;
    if (st === "saving") pill = { text: "Enregistrement…", color: "var(--muted)" };
    else if (st === "saved") pill = { text: "✓ Enregistré", color: "var(--sage-deep)" };
    else if (st && typeof st === "object" && "error" in st) pill = { text: `❌ ${st.error}`, color: "#8B2E2E" };
    else if (dirtyHere) pill = { text: "Modifié", color: "var(--gold-deep)" };
    return (
      <div key={key + lang} className={`content-field${dirtyHere ? " is-dirty" : ""}`}>
        <div className="content-field__head">
          <label className="admin-label">{label}</label>
          {pill && <span style={{ color: pill.color, fontSize: 11, fontWeight: 500 }}>{pill.text}</span>}
        </div>
        {variant === "textarea"
          ? <textarea {...inputProps} rows={3} style={{ minHeight: 72 }} />
          : <input {...inputProps} type="text" />}
      </div>
    );
  }

  return (
    <div className="content-editor">
      {/* Topbar: language switch + view link */}
      <div className="content-editor__topbar">
        <div className="content-editor__langs">
          <button type="button" className={`content-editor__lang-btn${lang === "fr" ? " is-active" : ""}`} onClick={() => setLang("fr")}>🇫🇷 Français</button>
          <button type="button" className={`content-editor__lang-btn${lang === "en" ? " is-active" : ""}`} onClick={() => setLang("en")}>🇬🇧 English</button>
        </div>
        <Link href="/a-propos" target="_blank" className="admin-btn ghost" style={{ fontSize: 11 }}>VOIR LA PAGE ↗</Link>
      </div>

      <p className="admin-sub" style={{ marginTop: 0, marginBottom: 18 }}>
        Vous éditez la version <b style={{ color: "var(--gold-deep)" }}>{lang === "fr" ? "française" : "anglaise"}</b>. Chaque bloc correspond exactement à une section de la page publique.
      </p>

      {/* ─── ① Bandeau d'accueil — text à gauche, photo à droite (comme sur le site) ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>① Bandeau d&apos;accueil</h2>
          <p>Le bandeau d&apos;introduction tout en haut. Photo à droite du titre sur le site.</p>
        </div>
        <div className="content-layout-hero">
          <div className="content-layout-hero__text">
            {field("eyebrow", "Surtitre (small caps)")}
            {field("title", "Titre — partie principale")}
            {field("titleAccent", "Titre — partie italique dorée")}
            {field("lead", "Sous-titre / accroche", "textarea")}
          </div>
          <div className="content-layout-hero__photo">
            <HeroPhotoUploader
              currentUrl={eyebrowPhotoUrl}
              caption="Photo à droite du bandeau. Format vertical recommandé (3:4)."
              ratio="3 / 4"
              saveAction={saveEyebrowPhotoAction}
            />
          </div>
        </div>
      </div>

      {/* ─── ② Mon histoire — photo à gauche, texte à droite (comme sur le site) ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>② Mon histoire</h2>
          <p>Bloc avec votre récit. Photo à gauche, texte à droite sur le site.</p>
        </div>
        <div className="content-layout-hero" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
          <div className="content-layout-hero__photo">
            <HeroPhotoUploader
              currentUrl={storyPhotoUrl}
              caption="Photo à côté du texte de votre histoire."
              ratio="3 / 4"
              saveAction={saveStoryPhotoAction}
            />
          </div>
          <div className="content-layout-hero__text">
            {field("bodyEyebrow", "Surtitre du bloc")}
            {field("bodyTitle", "Titre du bloc")}
            {field("body_0", "Paragraphe 1", "textarea")}
            {field("body_1", "Paragraphe 2", "textarea")}
            {field("body_2", "Paragraphe 3", "textarea")}
            {field("body_3", "Paragraphe 4", "textarea")}
          </div>
        </div>
      </div>

      {/* ─── ③ Mes valeurs — grille 2x2, pas de photo ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>③ Mes valeurs</h2>
          <p>Les 4 piliers affichés en grille. Pas de photo dans cette section.</p>
        </div>
        {field("valuesEyebrow", "Surtitre")}
        {field("valuesTitle", "Titre de la section")}
        <div className="content-values-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="content-values-cell">
              <div className="content-values-cell__head">Valeur {i + 1}</div>
              {field(`values_${i}_title`, "Titre")}
              {field(`values_${i}_body`, "Texte", "textarea")}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ④ Mon processus — 4 étapes, pas de photo ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>④ Mon processus</h2>
          <p>Les 4 étapes de votre accompagnement.</p>
        </div>
        {field("processEyebrow", "Surtitre")}
        {field("processTitle", "Titre de la section")}
        <div className="content-values-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="content-values-cell">
              <div className="content-values-cell__head">Étape {i + 1}</div>
              {field(`process_${i}_title`, "Titre")}
              {field(`process_${i}_body`, "Texte", "textarea")}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ⑤ Équipement — bloc sombre, pas de photo, 10 lignes ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>⑤ Équipement</h2>
          <p>Section sombre listant votre matériel.</p>
        </div>
        {field("gearEyebrow", "Surtitre")}
        {field("gearTitle", "Titre")}
        {field("gearLead", "Texte d'introduction", "textarea")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 10 }}>
          {Array.from({ length: 10 }, (_, i) => field(`gear_${i}`, `Ligne ${i + 1}`))}
        </div>
      </div>

      {/* Sticky save bar */}
      <div className={`content-editor__savebar${dirty ? " is-dirty" : ""}`}>
        <div className="content-editor__savebar-inner">
          <div className="content-editor__savebar-status">
            {saveStatus.kind === "ok" && <span style={{ color: "var(--sage-deep)" }}>✓ {saveStatus.count} champ{saveStatus.count > 1 ? "s" : ""} enregistré{saveStatus.count > 1 ? "s" : ""}</span>}
            {saveStatus.kind === "err" && <span style={{ color: "#8B2E2E" }}>❌ {saveStatus.message}</span>}
            {saveStatus.kind === "idle" && dirty && <span style={{ color: "var(--gold-deep)" }}>{dirtyKeys.length} modification{dirtyKeys.length > 1 ? "s" : ""} non enregistrée{dirtyKeys.length > 1 ? "s" : ""}</span>}
            {saveStatus.kind === "idle" && !dirty && <span style={{ color: "var(--muted)" }}>Aucune modification en attente.</span>}
          </div>
          <button type="button" className="admin-btn" onClick={handleSave} disabled={!dirty || saving} style={{ opacity: !dirty || saving ? 0.5 : 1 }}>
            {saving ? "Enregistrement…" : "ENREGISTRER"}
          </button>
        </div>
      </div>
    </div>
  );
}
