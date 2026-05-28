"use client";
import { useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import type {
  PageSection,
  SectionType,
  SectionData,
  TextSectionData,
  TextImageSectionData,
  QuoteSectionData,
  FullImageSectionData,
} from "@/lib/page-sections";

type Props = {
  page: string;
  initialSections: PageSection[];
  addAction: (page: string, type: SectionType) => Promise<{ ok: true; id: number } | { ok: false; error: string }>;
  updateAction: (id: number, data: SectionData) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteAction: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  moveAction: (page: string, id: number, direction: "up" | "down") => Promise<{ ok: true } | { ok: false; error: string }>;
};

const TYPE_INFO: Record<SectionType, { label: string; emoji: string; description: string }> = {
  "text":        { emoji: "📝", label: "Texte simple",      description: "Surtitre, titre et paragraphe centrés." },
  "text-image":  { emoji: "🖼️", label: "Image + texte",     description: "Photo à gauche ou à droite, texte de l'autre côté." },
  "quote":       { emoji: "💬", label: "Citation",          description: "Bandeau sauge avec monogramme et citation italique." },
  "full-image":  { emoji: "🌅", label: "Bandeau pleine largeur", description: "Photo plein écran avec légende optionnelle." },
};

export default function SectionsEditor({ page, initialSections, addAction, updateAction, deleteAction, moveAction }: Props) {
  const [sections, setSections] = useState(initialSections);
  const [pending, startTransition] = useTransition();
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [openSection, setOpenSection] = useState<number | null>(null);

  async function refresh() {
    // Cheap refresh: revalidatePath is called server-side; full page refresh
    // is the safest way to re-fetch with React Server Components.
    window.location.reload();
  }

  async function addSection(type: SectionType) {
    setShowTypePicker(false);
    startTransition(async () => {
      const res = await addAction(page, type);
      if (res.ok) await refresh();
      else alert(`❌ ${res.error}`);
    });
  }

  async function removeSection(id: number) {
    if (!confirm("Supprimer cette section ?")) return;
    startTransition(async () => {
      const res = await deleteAction(id);
      if (res.ok) await refresh();
      else alert(`❌ ${res.error}`);
    });
  }

  async function move(id: number, direction: "up" | "down") {
    startTransition(async () => {
      const res = await moveAction(page, id, direction);
      if (res.ok) await refresh();
      else alert(`❌ ${res.error}`);
    });
  }

  return (
    <div>
      {/* ── List of existing sections ─────────────────────────────── */}
      {sections.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, fontStyle: "italic", marginBottom: 22 }}>
          Aucune section personnalisée. Cliquez sur « + Ajouter une section » ci-dessous.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
          {sections.map((s, i) => {
            const info = TYPE_INFO[s.type];
            const isOpen = openSection === s.id;
            return (
              <div key={s.id} className="section-card">
                <header className="section-card__head">
                  <div className="section-card__title">
                    <span style={{ fontSize: 18, marginRight: 8 }}>{info.emoji}</span>
                    <span className="serif" style={{ fontSize: 17, color: "var(--forest)" }}>
                      Section {i + 1} — {info.label}
                    </span>
                  </div>
                  <div className="section-card__controls">
                    <button type="button" disabled={pending || i === 0} onClick={() => move(s.id, "up")} title="Monter">↑</button>
                    <button type="button" disabled={pending || i === sections.length - 1} onClick={() => move(s.id, "down")} title="Descendre">↓</button>
                    <button type="button" onClick={() => setOpenSection(isOpen ? null : s.id)}>
                      {isOpen ? "Replier" : "Modifier"}
                    </button>
                    <button type="button" className="section-card__delete" disabled={pending} onClick={() => removeSection(s.id)}>
                      ✕
                    </button>
                  </div>
                </header>
                {isOpen && (
                  <div className="section-card__body">
                    <SectionEditorBody
                      section={s}
                      onSave={async (data) => {
                        const res = await updateAction(s.id, data);
                        if (res.ok) {
                          setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, data } : x)));
                        }
                        return res;
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add new section ───────────────────────────────────────── */}
      {showTypePicker ? (
        <div className="section-type-picker">
          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--forest)" }}>Choisissez un type de section :</h4>
          <div className="section-type-grid">
            {(Object.keys(TYPE_INFO) as SectionType[]).map((t) => {
              const info = TYPE_INFO[t];
              return (
                <button
                  key={t}
                  type="button"
                  className="section-type-card"
                  disabled={pending}
                  onClick={() => addSection(t)}
                >
                  <div style={{ fontSize: 30, marginBottom: 6 }}>{info.emoji}</div>
                  <div className="serif" style={{ fontSize: 14, color: "var(--forest)" }}>{info.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{info.description}</div>
                </button>
              );
            })}
          </div>
          <button type="button" className="admin-btn ghost" onClick={() => setShowTypePicker(false)} style={{ marginTop: 12 }}>
            Annuler
          </button>
        </div>
      ) : (
        <button type="button" className="admin-btn" onClick={() => setShowTypePicker(true)} disabled={pending}>
          + AJOUTER UNE SECTION
        </button>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Section editor body — type-aware form
// ───────────────────────────────────────────────────────────────────
function SectionEditorBody({
  section,
  onSave,
}: {
  section: PageSection;
  onSave: (data: SectionData) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [data, setData] = useState<SectionData>(section.data);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");

  async function patch(updates: Partial<SectionData>) {
    const next = { ...data, ...updates } as SectionData;
    setData(next);
    setStatus("saving");
    const res = await onSave(next);
    if (res.ok) {
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1800);
    } else {
      setStatus({ error: res.error });
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    try {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const pathname = `posts/section-${section.id}-${ts}-${safe}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload-token",
      });
      return blob.url;
    } catch (e) {
      alert("❌ " + (e instanceof Error ? e.message : String(e)));
      return null;
    }
  }

  const statusPill = (() => {
    if (status === "saving") return <span style={{ color: "var(--muted)", fontSize: 11 }}>Enregistrement…</span>;
    if (status === "saved") return <span style={{ color: "var(--sage-deep)", fontSize: 11 }}>✓ Enregistré</span>;
    if (typeof status === "object") return <span style={{ color: "#8B2E2E", fontSize: 11 }}>❌ {status.error}</span>;
    return null;
  })();

  const Field = ({ label, value, onChange, variant = "input", hint }: { label: string; value: string; onChange: (v: string) => void; variant?: "input" | "textarea"; hint?: string }) => (
    <div style={{ marginBottom: 10 }}>
      <label className="admin-label" style={{ display: "block", marginBottom: 4 }}>{label}</label>
      {variant === "textarea" ? (
        <textarea className="admin-textarea" value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => patch({})} rows={3} />
      ) : (
        <input className="admin-input" type="text" value={value} onChange={(e) => onChange(e.target.value)} onBlur={() => patch({})} />
      )}
      {hint && <p className="content-field__hint">{hint}</p>}
    </div>
  );

  return (
    <div>
      <div style={{ textAlign: "right", marginBottom: 10, minHeight: 16 }}>{statusPill}</div>

      {section.type === "text" && (
        <TextEditor data={data as TextSectionData} patch={patch} Field={Field} />
      )}
      {section.type === "text-image" && (
        <TextImageEditor data={data as TextImageSectionData} patch={patch} Field={Field} uploadImage={uploadImage} />
      )}
      {section.type === "quote" && (
        <QuoteEditor data={data as QuoteSectionData} patch={patch} Field={Field} />
      )}
      {section.type === "full-image" && (
        <FullImageEditor data={data as FullImageSectionData} patch={patch} Field={Field} uploadImage={uploadImage} />
      )}
    </div>
  );
}

// Per-type editors — kept inline because they're tiny and very type-specific.
type FieldComponent = (props: { label: string; value: string; onChange: (v: string) => void; variant?: "input" | "textarea"; hint?: string }) => React.JSX.Element;

function TextEditor({ data, patch, Field }: { data: TextSectionData; patch: (u: Partial<TextSectionData>) => void; Field: FieldComponent }) {
  return (
    <>
      <div className="section-bilingual">
        <div>
          <h5 className="section-lang-label">🇫🇷 Français</h5>
          <Field label="Surtitre" value={data.eyebrow_fr ?? ""} onChange={(v) => patch({ eyebrow_fr: v })} />
          <Field label="Titre" value={data.title_fr ?? ""} onChange={(v) => patch({ title_fr: v })} />
          <Field label="Paragraphe" value={data.body_fr ?? ""} onChange={(v) => patch({ body_fr: v })} variant="textarea" />
        </div>
        <div>
          <h5 className="section-lang-label">🇬🇧 English</h5>
          <Field label="Eyebrow" value={data.eyebrow_en ?? ""} onChange={(v) => patch({ eyebrow_en: v })} />
          <Field label="Title" value={data.title_en ?? ""} onChange={(v) => patch({ title_en: v })} />
          <Field label="Paragraph" value={data.body_en ?? ""} onChange={(v) => patch({ body_en: v })} variant="textarea" />
        </div>
      </div>
      <div className="section-row">
        <label className="admin-label">Alignement</label>
        <select className="admin-select" value={data.align ?? "center"} onChange={(e) => patch({ align: e.target.value as "center" | "left" })}>
          <option value="center">Centré</option>
          <option value="left">Aligné à gauche</option>
        </select>
        <label className="admin-label">Fond</label>
        <select className="admin-select" value={data.background ?? "cream"} onChange={(e) => patch({ background: e.target.value as "cream" | "cream-deep" | "white" })}>
          <option value="cream">Crème</option>
          <option value="cream-deep">Crème foncé</option>
          <option value="white">Blanc</option>
        </select>
      </div>
    </>
  );
}

function TextImageEditor({ data, patch, Field, uploadImage }: { data: TextImageSectionData; patch: (u: Partial<TextImageSectionData>) => void; Field: FieldComponent; uploadImage: (f: File) => Promise<string | null> }) {
  return (
    <>
      <div className="section-image-row">
        <div className="section-image-preview" style={{ aspectRatio: "4 / 5", background: "var(--cream-deep)" }}>
          {data.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.image_url} alt="Aperçu" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: data.image_focal || "center center" }} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--muted)", fontSize: 12 }}>Aucune photo</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label className="cover-picker__btn cover-picker__btn--ghost" style={{ display: "inline-flex" }}>
            ⬆ {data.image_url ? "Remplacer la photo" : "Téléverser une photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) {
                  const url = await uploadImage(f);
                  if (url) patch({ image_url: url });
                }
              }}
            />
          </label>
          <div className="section-row" style={{ marginTop: 12 }}>
            <label className="admin-label">Position de la photo</label>
            <select className="admin-select" value={data.image_position ?? "right"} onChange={(e) => patch({ image_position: e.target.value as "left" | "right" })}>
              <option value="left">À gauche</option>
              <option value="right">À droite</option>
            </select>
          </div>
        </div>
      </div>
      <div className="section-bilingual">
        <div>
          <h5 className="section-lang-label">🇫🇷 Français</h5>
          <Field label="Surtitre" value={data.eyebrow_fr ?? ""} onChange={(v) => patch({ eyebrow_fr: v })} />
          <Field label="Titre" value={data.title_fr ?? ""} onChange={(v) => patch({ title_fr: v })} />
          <Field label="Paragraphe" value={data.body_fr ?? ""} onChange={(v) => patch({ body_fr: v })} variant="textarea" />
          <Field label="Texte du bouton" value={data.cta_label_fr ?? ""} onChange={(v) => patch({ cta_label_fr: v })} />
        </div>
        <div>
          <h5 className="section-lang-label">🇬🇧 English</h5>
          <Field label="Eyebrow" value={data.eyebrow_en ?? ""} onChange={(v) => patch({ eyebrow_en: v })} />
          <Field label="Title" value={data.title_en ?? ""} onChange={(v) => patch({ title_en: v })} />
          <Field label="Paragraph" value={data.body_en ?? ""} onChange={(v) => patch({ body_en: v })} variant="textarea" />
          <Field label="Button label" value={data.cta_label_en ?? ""} onChange={(v) => patch({ cta_label_en: v })} />
        </div>
      </div>
      <Field label="Lien du bouton (URL)" value={data.cta_href ?? ""} onChange={(v) => patch({ cta_href: v })} hint="Exemple : /contact ou https://…" />
    </>
  );
}

function QuoteEditor({ data, patch, Field }: { data: QuoteSectionData; patch: (u: Partial<QuoteSectionData>) => void; Field: FieldComponent }) {
  return (
    <>
      <div className="section-bilingual">
        <div>
          <h5 className="section-lang-label">🇫🇷 Français</h5>
          <Field label="Citation" value={data.quote_fr ?? ""} onChange={(v) => patch({ quote_fr: v })} variant="textarea" />
        </div>
        <div>
          <h5 className="section-lang-label">🇬🇧 English</h5>
          <Field label="Quote" value={data.quote_en ?? ""} onChange={(v) => patch({ quote_en: v })} variant="textarea" />
        </div>
      </div>
      <Field label="Attribution (commune)" value={data.author ?? ""} onChange={(v) => patch({ author: v })} hint="Exemple : « — Mickael Romero »" />
    </>
  );
}

function FullImageEditor({ data, patch, Field, uploadImage }: { data: FullImageSectionData; patch: (u: Partial<FullImageSectionData>) => void; Field: FieldComponent; uploadImage: (f: File) => Promise<string | null> }) {
  return (
    <>
      <div className="section-image-preview" style={{ aspectRatio: "16 / 9", background: "var(--cream-deep)", marginBottom: 12 }}>
        {data.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image_url} alt="Aperçu" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: data.image_focal || "center center" }} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--muted)", fontSize: 12 }}>Aucune photo</div>
        )}
      </div>
      <label className="cover-picker__btn cover-picker__btn--ghost" style={{ display: "inline-flex" }}>
        ⬆ {data.image_url ? "Remplacer la photo" : "Téléverser une photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) {
              const url = await uploadImage(f);
              if (url) patch({ image_url: url });
            }
          }}
        />
      </label>
      <div className="section-bilingual" style={{ marginTop: 14 }}>
        <div>
          <h5 className="section-lang-label">🇫🇷 Français</h5>
          <Field label="Légende (optionnelle)" value={data.caption_fr ?? ""} onChange={(v) => patch({ caption_fr: v })} />
        </div>
        <div>
          <h5 className="section-lang-label">🇬🇧 English</h5>
          <Field label="Caption (optional)" value={data.caption_en ?? ""} onChange={(v) => patch({ caption_en: v })} />
        </div>
      </div>
    </>
  );
}
