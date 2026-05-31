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
  heroPhoto: string;
  cardPhotos: [string, string, string, string];
  zoomPhoto: string;
  galleryPhotos: [string, string, string, string];
  saveAction: (page: string, edits: ContentEdit[]) => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
  savePhotoHero:    (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoZoom:    (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoCard0:   (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoCard1:   (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoCard2:   (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoCard3:   (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoGallery0: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoGallery1: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoGallery2: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  savePhotoGallery3: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Visual editor for the Prestations page. Reproduces the public layout
 * top → bottom:
 *   ① Bandeau d'accueil  : texts + hero photo (right)
 *   ② Cartes prestations : 4 cards (photo on top of each + texts under)
 *   ③ Formules mariage   : texts on left + photo on right + includes list
 *   ④ Galerie images     : 4 photos in a band + galleryEyebrow above
 *   ⑤ CTA final          : single button label
 */

function resolved(o: Record<string, string>, d: Record<string, string>) {
  const out: Record<string, string> = { ...d };
  for (const [k, v] of Object.entries(o)) if (v != null) out[k] = v;
  return out;
}

type FS = "idle" | "saving" | "saved" | { error: string };

export default function ServicesContentEditor(props: Props) {
  const {
    initialFr, initialEn, defaultsFr, defaultsEn,
    heroPhoto, cardPhotos, zoomPhoto, galleryPhotos,
    saveAction,
    savePhotoHero, savePhotoZoom,
    savePhotoCard0, savePhotoCard1, savePhotoCard2, savePhotoCard3,
    savePhotoGallery0, savePhotoGallery1, savePhotoGallery2, savePhotoGallery3,
  } = props;

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
  const [fieldStatus, setFieldStatus] = useState<Record<string, FS>>({});

  function setOneStatus(k: string, s: FS) {
    setFieldStatus((p) => ({ ...p, [k]: s }));
    if (s === "saved") {
      setTimeout(() => setFieldStatus((p) => (p[k] === "saved" ? { ...p, [k]: "idle" } : p)), 1800);
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
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function setVal(k: string, v: string) {
    if (lang === "fr") setFr((p) => ({ ...p, [k]: v }));
    else setEn((p) => ({ ...p, [k]: v }));
  }
  function getVal(k: string) { return (lang === "fr" ? fr[k] : en[k]) ?? ""; }
  function getDef(k: string) { return (lang === "fr" ? defaultsFr[k] : defaultsEn[k]) ?? ""; }
  function isDirtyKey(k: string) {
    const cur = lang === "fr" ? fr[k] ?? "" : en[k] ?? "";
    const init = lang === "fr" ? baselineFr[k] ?? "" : baselineEn[k] ?? "";
    return cur !== init;
  }

  async function autoSaveField(k: string) {
    const cur = lang === "fr" ? fr[k] ?? "" : en[k] ?? "";
    const base = lang === "fr" ? baselineFr[k] ?? "" : baselineEn[k] ?? "";
    if (cur === base) return;
    const stKey = `${k}:${lang}`;
    setOneStatus(stKey, "saving");
    const def = lang === "fr" ? defaultsFr[k] ?? "" : defaultsEn[k] ?? "";
    const payload = cur === def ? "" : cur;
    const res = await saveAction("services", [{ key: k, lang, value: payload }]);
    if (res.ok) {
      if (lang === "fr") baselineFr[k] = cur;
      else baselineEn[k] = cur;
      setOneStatus(stKey, "saved");
    } else {
      setOneStatus(stKey, { error: res.error });
    }
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveStatus({ kind: "idle" });
    const res = await saveAction("services", dirtyKeys);
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

  function field(key: string, label: string, variant: "input" | "textarea" = "input") {
    const val = getVal(key);
    const def = getDef(key);
    const stKey = `${key}:${lang}`;
    const st = fieldStatus[stKey];
    const dirtyHere = isDirtyKey(key);
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

  const CARD_PHOTO_SAVERS = [savePhotoCard0, savePhotoCard1, savePhotoCard2, savePhotoCard3];
  const GAL_PHOTO_SAVERS = [savePhotoGallery0, savePhotoGallery1, savePhotoGallery2, savePhotoGallery3];

  return (
    <div className="content-editor">
      <div className="content-editor__topbar">
        <div className="content-editor__langs">
          <button type="button" className={`content-editor__lang-btn${lang === "fr" ? " is-active" : ""}`} onClick={() => setLang("fr")}>🇫🇷 Français</button>
          <button type="button" className={`content-editor__lang-btn${lang === "en" ? " is-active" : ""}`} onClick={() => setLang("en")}>🇬🇧 English</button>
        </div>
        <Link href="/prestations" target="_blank" className="admin-btn ghost" style={{ fontSize: 11 }}>VOIR LA PAGE ↗</Link>
      </div>

      <p className="admin-sub" style={{ marginTop: 0, marginBottom: 18 }}>
        Vous éditez la version <b style={{ color: "var(--gold-deep)" }}>{lang === "fr" ? "française" : "anglaise"}</b>. Chaque bloc reproduit exactement la structure de la page publique.
      </p>

      {/* ─── ① Bandeau d'accueil ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>① Bandeau d&apos;accueil</h2>
          <p>Bandeau d&apos;intro avec photo à droite du titre.</p>
        </div>
        <div className="content-layout-hero">
          <div className="content-layout-hero__text">
            {field("eyebrow", "Surtitre")}
            {field("title", "Titre — partie principale")}
            {field("titleAccent", "Titre — partie italique dorée")}
            {field("lead", "Sous-titre", "textarea")}
          </div>
          <div className="content-layout-hero__photo">
            <HeroPhotoUploader currentUrl={heroPhoto} caption="Photo principale du bandeau." ratio="3 / 4" saveAction={savePhotoHero} />
          </div>
        </div>
      </div>

      {/* ─── ② Les 4 cartes prestations — photo en haut de chaque carte ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>② Les 4 cartes prestations</h2>
          <p>Quatre cartes alignées en grille — photo en haut, puis titre, baseline, prix et descriptif.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ background: "var(--cream)", border: "1px solid var(--rule)", borderRadius: 6, padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <HeroPhotoUploader currentUrl={cardPhotos[i]} caption={`Photo de la carte ${i + 1}`} ratio="4 / 3" saveAction={CARD_PHOTO_SAVERS[i]} />
              </div>
              {field(`cards_${i}_title`, `Carte ${i + 1} — titre`)}
              {field(`cards_${i}_subtitle`, "Baseline")}
              {field(`cards_${i}_price`, "Prix")}
              {field(`cards_${i}_body`, "Description", "textarea")}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ③ Bloc « Formules mariage » — texte + photo ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>③ Bloc « Formules mariage »</h2>
          <p>Texte à gauche, photo à droite, liste de 4 formules dessous.</p>
        </div>
        <div className="content-layout-hero">
          <div className="content-layout-hero__text">
            {field("zoomEyebrow", "Surtitre")}
            {field("zoomTitle", "Titre du bloc")}
            {field("zoomIntro", "Texte d'intro", "textarea")}
          </div>
          <div className="content-layout-hero__photo">
            <HeroPhotoUploader currentUrl={zoomPhoto} caption="Photo qui accompagne le bloc des formules." ratio="3 / 2" saveAction={savePhotoZoom} />
          </div>
        </div>
        <div className="content-values-grid" style={{ marginTop: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="content-values-cell">
              <div className="content-values-cell__head">Formule {i + 1}</div>
              {field(`includes_${i}_title`, "Titre")}
              {field(`includes_${i}_body`, "Texte", "textarea")}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ④ Galerie en bas — 4 photos en bande ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>④ Galerie en bas de page</h2>
          <p>Quatre photos en bande au bas de la page, juste avant le CTA final.</p>
        </div>
        {field("galleryEyebrow", "Surtitre au-dessus de la galerie")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>Photo {i + 1}</p>
              <HeroPhotoUploader currentUrl={galleryPhotos[i]} caption="" ratio="4 / 5" saveAction={GAL_PHOTO_SAVERS[i]} />
            </div>
          ))}
        </div>
      </div>

      {/* ─── ⑤ CTA final ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>⑤ Bouton CTA final</h2>
          <p>Le grand bouton sauge tout en bas de la page.</p>
        </div>
        {field("cta", "Texte du bouton")}
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
