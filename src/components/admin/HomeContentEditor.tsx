"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import HeroPhotoUploader from "@/components/admin/HeroPhotoUploader";

type Lang = "fr" | "en";

type FieldSpec = {
  key: string;
  label: string;
  variant?: "input" | "textarea";
  hint?: string;
};

type ContentEdit = { key: string; lang: Lang; value: string };

type FeaturedGallery = {
  id: number;
  slug: string;
  names: string;
  place: string;
  coverUrl: string;
  coverPosition: string;
  /** cochée « mise en avant (accueil) » */
  featured: boolean;
};

type Props = {
  initialFr: Record<string, string>;
  initialEn: Record<string, string>;
  defaultsFr: Record<string, string>;
  defaultsEn: Record<string, string>;
  /** TOUTES les galeries publiées — celles cochées alimentent la home */
  galleries: FeaturedGallery[];
  setFeaturedAction: (galleryId: number, featured: boolean) => Promise<{ ok: true }>;
  heroPhoto: string;
  heroPhotoFocal?: string;
  teaserPhotos: [string, string, string, string];
  teaserFocals: [string, string, string, string];
  saveAction: (
    page: string,
    edits: ContentEdit[]
  ) => Promise<{ ok: true; count: number } | { ok: false; error: string }>;
  saveHeroAction: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveHeroFocalAction?: (focal: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserPhoto0: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserPhoto1: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserPhoto2: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserPhoto3: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserFocal0?: (f: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserFocal1?: (f: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserFocal2?: (f: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  saveTeaserFocal3?: (f: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * Ordered field specs that mirror the home page top-to-bottom layout.
 * Same keys are used for both languages; only the input bindings differ
 * depending on which language the editor is currently focused on.
 */
const HERO_FIELDS: FieldSpec[] = [
  { key: "eyebrow",  label: "Phrase de surtitre", hint: "Petite phrase au-dessus du titre, en petites majuscules dorées." },
  { key: "title1",   label: "Titre — première ligne" },
  { key: "title2",   label: "Titre — deuxième ligne (italique doré)" },
  { key: "sub",      label: "Sous-titre / paragraphe d'introduction", variant: "textarea" },
  { key: "cta",      label: "Bouton principal (sauge)" },
  { key: "locale",   label: "Ligne du bas (« Nice — Côte d'Azur — Worldwide »)" },
];
const VALUES_HEAD: FieldSpec[] = [
  { key: "valuesEyebrow", label: "Surtitre" },
  { key: "valuesTitle",   label: "Titre de la section" },
];
const FEATURED_FIELDS: FieldSpec[] = [
  { key: "featuredEyebrow", label: "Surtitre" },
  { key: "featuredTitle",   label: "Titre de section" },
  { key: "featuredCta",     label: "Bouton « Tout le portfolio »" },
];
const QUOTE_FIELDS: FieldSpec[] = [
  { key: "bandQuote", label: "Citation (italique)", variant: "textarea" },
  { key: "bandAttr",  label: "Attribution (« — Mickael Romero »)" },
];
const TEASER_FIELDS: FieldSpec[] = [
  { key: "teaser_eyebrow",     label: "Surtitre" },
  { key: "teaser_title",       label: "Titre — partie principale" },
  { key: "teaser_titleAccent", label: "Titre — partie italique dorée" },
  { key: "teaser_lead",        label: "Texte de présentation", variant: "textarea" },
  { key: "teaser_cta",         label: "Bouton vers /prestations" },
];

/**
 * Resolve the value displayed in a field. Overrides win over defaults so
 * the photographer ALWAYS sees real text in the input — never an empty
 * box with the default in greyed-out placeholder (which disappeared the
 * moment she clicked, making small edits like adding an 's' painful).
 */
function resolvedInitial(
  overrides: Record<string, string>,
  defaults: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = { ...defaults };
  for (const [k, v] of Object.entries(overrides)) {
    if (v != null) out[k] = v;
  }
  return out;
}

export default function HomeContentEditor({
  initialFr, initialEn, defaultsFr, defaultsEn,
  galleries, setFeaturedAction, heroPhoto, heroPhotoFocal, teaserPhotos, teaserFocals,
  saveAction, saveHeroAction, saveHeroFocalAction,
  saveTeaserPhoto0, saveTeaserPhoto1, saveTeaserPhoto2, saveTeaserPhoto3,
  saveTeaserFocal0, saveTeaserFocal1, saveTeaserFocal2, saveTeaserFocal3,
}: Props) {
  const [lang, setLang] = useState<Lang>("fr");
  // Resolved values: override (if set) or factory default. Pre-filled so
  // the input is always editable in place.
  const [fr, setFr] = useState<Record<string, string>>(() => resolvedInitial(initialFr, defaultsFr));
  const [en, setEn] = useState<Record<string, string>>(() => resolvedInitial(initialEn, defaultsEn));
  const [saving, setSaving] = useState(false);

  // ─── Bloc ③ : sélection des galeries à la une ───────────────────────
  // Cocher se fait ICI, sur la page qui décide de ce que la home affiche.
  // Avant, le bloc se contentait de lister les galeries déjà marquées :
  // quand aucune ne l'était, il n'y avait rien à modifier et il fallait
  // deviner qu'il fallait passer par la fiche de chaque galerie.
  const [gals, setGals] = useState<FeaturedGallery[]>(galleries);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const shownOnHome = useMemo(() => gals.filter((g) => g.featured).slice(0, 3), [gals]);

  async function toggleFeatured(id: number, next: boolean) {
    setFeaturedError(null);
    setSavingId(id);
    // Optimiste : la case bascule tout de suite, on revient en arrière si
    // le serveur refuse — sinon l'écran ment sur l'état réel du site.
    setGals((prev) => prev.map((g) => (g.id === id ? { ...g, featured: next } : g)));
    try {
      const res = await setFeaturedAction(id, next);
      if (!res?.ok) throw new Error("réponse inattendue du serveur");
    } catch (e) {
      setGals((prev) => prev.map((g) => (g.id === id ? { ...g, featured: !next } : g)));
      setFeaturedError(
        `Impossible d'enregistrer la mise en avant (${e instanceof Error ? e.message : String(e)}). Rien n'a été changé.`
      );
    } finally {
      setSavingId(null);
    }
  }

  const [saveStatus, setSaveStatus] = useState<{ kind: "idle" } | { kind: "ok"; count: number } | { kind: "err"; message: string }>({ kind: "idle" });

  // Baseline mirrors the resolved values — used for dirty detection.
  // We mutate the objects in place after a successful save so the
  // useMemo below recomputes correctly.
  const [baselineFr] = useState<Record<string, string>>(() => resolvedInitial(initialFr, defaultsFr));
  const [baselineEn] = useState<Record<string, string>>(() => resolvedInitial(initialEn, defaultsEn));

  const dirtyKeys = useMemo(() => {
    const out: ContentEdit[] = [];
    const keys = new Set([
      ...Object.keys(fr), ...Object.keys(baselineFr),
      ...Object.keys(en), ...Object.keys(baselineEn),
    ]);
    for (const k of keys) {
      if ((fr[k] ?? "") !== (baselineFr[k] ?? "")) {
        // If the new value matches the i18n default, send "" so the
        // server deletes the override row and the factory text returns.
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

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Per-field auto-save status: 'idle' | 'saving' | 'saved' | { error }.
  // Drives the inline pill that confirms each blur-save lived through.
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

  // Helpers
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

  /**
   * Auto-save a single field on blur. Fires only if the value has
   * actually changed since the last save — protects against blur events
   * triggered by clicking the save button itself.
   */
  async function autoSaveField(key: string) {
    const cur = lang === "fr" ? fr[key] ?? "" : en[key] ?? "";
    const base = lang === "fr" ? baselineFr[key] ?? "" : baselineEn[key] ?? "";
    if (cur === base) return;
    const stKey = `${key}:${lang}`;
    setOneStatus(stKey, "saving");
    // If the new value matches the i18n default, send "" so the override
    // row is deleted and the factory text comes back naturally.
    const def = lang === "fr" ? defaultsFr[key] ?? "" : defaultsEn[key] ?? "";
    const payload = cur === def ? "" : cur;
    const res = await saveAction("home", [{ key, lang, value: payload }]);
    if (res.ok) {
      // Move the baseline so this field is no longer "dirty".
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
    const res = await saveAction("home", dirtyKeys);
    setSaving(false);
    if (res.ok) {
      // Move baselines so dirtyKeys recomputes to empty.
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
    const empty = val.trim() === "";
    const stKey = `${f.key}:${lang}`;
    const st = fieldStatus[stKey];
    const inputProps = {
      value: val,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(f.key, e.target.value),
      onBlur: () => autoSaveField(f.key),
      placeholder: empty ? def : "",
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
            <span className="content-field__dirty-pill" style={{ background: "transparent", color: pill.color, padding: 0, letterSpacing: "0.04em", textTransform: "none", fontWeight: 500, fontSize: 11 }}>
              {pill.text}
            </span>
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
                // Auto-save the reset (so override row is deleted).
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
      {/* ─── Header: language switch + bouton voir page ────────────── */}
      <div className="content-editor__topbar">
        <div className="content-editor__langs">
          <button
            type="button"
            className={`content-editor__lang-btn${lang === "fr" ? " is-active" : ""}`}
            onClick={() => setLang("fr")}
          >
            🇫🇷 Français
          </button>
          <button
            type="button"
            className={`content-editor__lang-btn${lang === "en" ? " is-active" : ""}`}
            onClick={() => setLang("en")}
          >
            🇬🇧 English
          </button>
        </div>
        <Link href="/" target="_blank" className="admin-btn ghost" style={{ fontSize: 11 }}>
          VOIR LA PAGE ↗
        </Link>
      </div>

      <p className="admin-sub" style={{ marginTop: 0, marginBottom: 18 }}>
        Vous éditez actuellement la version <b style={{ color: "var(--gold-deep)" }}>{lang === "fr" ? "française" : "anglaise"}</b>.
        Modifiez tous les champs voulus puis cliquez sur <b>ENREGISTRER</b> en bas pour appliquer.
      </p>

      {/* ─── ① HERO ─────────────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>① Bandeau d&apos;accueil</h2>
          <p>La toute première chose que voient les visiteurs.</p>
        </div>
        <div className="content-layout-hero">
          <div className="content-layout-hero__text">
            {HERO_FIELDS.map(renderField)}
          </div>
          <div className="content-layout-hero__photo">
            <HeroPhotoUploader
              currentUrl={heroPhoto}
              currentFocal={heroPhotoFocal}
              caption="Cliquez sur la photo pour choisir le cadrage. Remplacez avec « 📷 Remplacer la photo »."
              ratio="3 / 4"
              saveAction={saveHeroAction}
              saveFocalAction={saveHeroFocalAction}
            />
          </div>
        </div>
      </div>

      {/* ─── ② VALUES ──────────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>② Bande des valeurs</h2>
          <p>Les quatre piliers qui définissent votre signature.</p>
        </div>
        {VALUES_HEAD.map(renderField)}
        <div className="content-values-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="content-values-cell">
              <div className="content-values-cell__head">Valeur {i + 1}</div>
              {renderField({ key: `values_${i}_title`, label: "Titre" })}
              {renderField({ key: `values_${i}_body`, label: "Texte", variant: "textarea" })}
            </div>
          ))}
        </div>
      </div>

      {/* ─── ③ FEATURED ───────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>③ Mariages à la une</h2>
          <p>
            Cochez les galeries à afficher sur l&apos;accueil. <strong>Les 3 premières cochées</strong> sont
            reprises dans la section « {(lang === "fr" ? fr : en)["featuredEyebrow"] || "Derniers mariages"} » de la page d&apos;accueil ; l&apos;ordre suit
            celui du portfolio. La photo affichée est la <em>couverture</em> de la galerie — pour la changer,
            ouvrez la galerie.
          </p>
        </div>
        {FEATURED_FIELDS.map(renderField)}

        {shownOnHome.length > 0 && (
          <div className="content-featured-row">
            {shownOnHome.map((g, i) => (
              <div key={g.id} className="content-featured-card">
                <div className="content-featured-card__photo">
                  {g.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.coverUrl} alt={g.names} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: g.coverPosition }} />
                  )}
                </div>
                <div className="content-featured-card__title serif">{i + 1}. {g.names}</div>
                <div className="content-featured-card__sub">{g.place}</div>
                <Link href={`/admin/galleries/${g.id}`} className="cap-tracked-sm gold" style={{ fontSize: 10 }}>
                  CHANGER LA PHOTO ↗
                </Link>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div className="cap-tracked-sm" style={{ marginBottom: 10, opacity: 0.7 }}>
            TOUTES LES GALERIES ({gals.length})
          </div>
          {gals.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Aucune galerie publiée pour l&apos;instant.{" "}
              <Link href="/admin/galleries" className="gold" style={{ textDecoration: "underline" }}>
                Créer une galerie
              </Link>
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {gals.map((g) => {
                const rank = shownOnHome.findIndex((x) => x.id === g.id);
                return (
                  <label
                    key={g.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                      border: "1px solid rgba(0,0,0,.08)", borderRadius: 8, cursor: "pointer",
                      background: g.featured ? "rgba(191,161,102,.10)" : "transparent",
                      opacity: savingId === g.id ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={g.featured}
                      disabled={savingId !== null}
                      onChange={(e) => toggleFeatured(g.id, e.target.checked)}
                    />
                    {g.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.coverUrl}
                        alt=""
                        style={{ width: 44, height: 44, objectFit: "cover", objectPosition: g.coverPosition, borderRadius: 4, flexShrink: 0 }}
                      />
                    )}
                    <span style={{ flex: 1 }}>
                      <span className="serif" style={{ fontSize: 16 }}>{g.names}</span>
                      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{g.place}</span>
                    </span>
                    {rank >= 0 && (
                      <span className="cap-tracked-sm gold" style={{ fontSize: 10 }}>
                        SUR L&apos;ACCUEIL · {rank + 1}
                      </span>
                    )}
                    {g.featured && rank < 0 && (
                      <span className="muted" style={{ fontSize: 11 }}>cochée, hors des 3 premières</span>
                    )}
                    <Link href={`/admin/galleries/${g.id}`} className="cap-tracked-sm gold" style={{ fontSize: 10 }}>
                      OUVRIR ↗
                    </Link>
                  </label>
                );
              })}
            </div>
          )}
          {featuredError && (
            <p style={{ color: "#b23", fontSize: 13, marginTop: 8 }}>{featuredError}</p>
          )}
        </div>
      </div>

      {/* ─── ④ QUOTE ──────────────────────────────────────────────── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>④ Bande citation</h2>
          <p>Le bandeau sauge avec le monogramme et une citation au milieu.</p>
        </div>
        {QUOTE_FIELDS.map(renderField)}
      </div>

      {/* ─── ⑤ BLOC PRESTATIONS (TEASER) — texte à gauche, 4 photos à droite ─── */}
      <div className="admin-card">
        <div className="content-section-head">
          <h2>⑤ Bloc Prestations (teaser)</h2>
          <p>Tout en bas de la page : texte de présentation à gauche, mosaïque de 4 photos à droite.</p>
        </div>
        <div className="content-layout-hero">
          <div className="content-layout-hero__text">
            {TEASER_FIELDS.map(renderField)}
          </div>
          <div className="content-layout-hero__photo">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[0, 1, 2, 3].map((i) => {
                const photo = teaserPhotos[i];
                const focal = teaserFocals[i];
                const saveUrl = [saveTeaserPhoto0, saveTeaserPhoto1, saveTeaserPhoto2, saveTeaserPhoto3][i];
                const saveFocal = [saveTeaserFocal0, saveTeaserFocal1, saveTeaserFocal2, saveTeaserFocal3][i];
                return (
                  <div key={i}>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>Photo {i + 1}</p>
                    <HeroPhotoUploader
                      currentUrl={photo}
                      currentFocal={focal}
                      caption=""
                      ratio="3 / 4"
                      saveAction={saveUrl}
                      saveFocalAction={saveFocal}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sticky save bar ─────────────────────────────────────── */}
      <div className={`content-editor__savebar${dirty ? " is-dirty" : ""}`}>
        <div className="content-editor__savebar-inner">
          <div className="content-editor__savebar-status">
            {saveStatus.kind === "ok" && (
              <span style={{ color: "var(--sage-deep)" }}>
                ✓ {saveStatus.count} champ{saveStatus.count > 1 ? "s" : ""} enregistré{saveStatus.count > 1 ? "s" : ""}
              </span>
            )}
            {saveStatus.kind === "err" && (
              <span style={{ color: "#8B2E2E" }}>❌ {saveStatus.message}</span>
            )}
            {saveStatus.kind === "idle" && dirty && (
              <span style={{ color: "var(--gold-deep)" }}>
                {dirtyKeys.length} modification{dirtyKeys.length > 1 ? "s" : ""} non enregistrée{dirtyKeys.length > 1 ? "s" : ""}
              </span>
            )}
            {saveStatus.kind === "idle" && !dirty && (
              <span style={{ color: "var(--muted)" }}>Aucune modification de texte en attente. <span style={{ color: "var(--sage-deep)", marginLeft: 6 }}>(Photos et cadrages s’enregistrent automatiquement.)</span></span>
            )}
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
