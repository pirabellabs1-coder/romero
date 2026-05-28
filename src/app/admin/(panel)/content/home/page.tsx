import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import ContentField from "@/components/admin/ContentField";
import { saveContentField } from "../actions";

export const dynamic = "force-dynamic";

// ── Fields exposed to the photographer on the Home page editor. ───────
// `key` matches the i18n leaf used by `app/(site)/page.tsx`. For arrays
// like `values` we flatten to numbered keys (values_0_title, etc.) so
// each is editable individually.
type FieldSpec = {
  key: string;
  label: string;
  variant?: "input" | "textarea";
  hint?: string;
};
type SectionSpec = { title: string; description?: string; fields: FieldSpec[] };

const SECTIONS: SectionSpec[] = [
  {
    title: "Hero — bandeau d'accueil",
    description: "La toute première chose que voient les visiteurs.",
    fields: [
      { key: "eyebrow",   label: "Phrase de surtitre (small caps)", hint: "Exemple : « QUELQUE PART ENTRE MER ET PINS »." },
      { key: "title1",    label: "Titre — première ligne" },
      { key: "title2",    label: "Titre — deuxième ligne (italique doré)" },
      { key: "sub",       label: "Sous-titre (paragraphe)", variant: "textarea" },
      { key: "cta",       label: "Bouton principal (sauge)" },
      { key: "locale",    label: "Ligne du bas (« Nice — Côte d'Azur — Worldwide »)" },
    ],
  },
  {
    title: "Bande des valeurs",
    description: "Les quatre piliers présentés sur fond crème.",
    fields: [
      { key: "valuesEyebrow", label: "Surtitre (small caps)" },
      { key: "valuesTitle",   label: "Titre de la section" },
      { key: "values_0_title", label: "Valeur 1 — titre" },
      { key: "values_0_body",  label: "Valeur 1 — texte", variant: "textarea" },
      { key: "values_1_title", label: "Valeur 2 — titre" },
      { key: "values_1_body",  label: "Valeur 2 — texte", variant: "textarea" },
      { key: "values_2_title", label: "Valeur 3 — titre" },
      { key: "values_2_body",  label: "Valeur 3 — texte", variant: "textarea" },
      { key: "values_3_title", label: "Valeur 4 — titre" },
      { key: "values_3_body",  label: "Valeur 4 — texte", variant: "textarea" },
    ],
  },
  {
    title: "Mariages à la une",
    description: "Au-dessus de la grille des 3 galeries mises en avant.",
    fields: [
      { key: "featuredEyebrow", label: "Surtitre (small caps)" },
      { key: "featuredTitle",   label: "Titre de section" },
      { key: "featuredCta",     label: "Bouton « Tout le portfolio »" },
    ],
  },
  {
    title: "Citation médian",
    description: "La bande verte sauge avec le monogramme.",
    fields: [
      { key: "bandQuote", label: "Citation (italique)", variant: "textarea" },
      { key: "bandAttr",  label: "Attribution (« — Mickael Romero »)" },
    ],
  },
];

// Map the flat key to the actual i18n location so we can show the default.
function getDefault(lang: "fr" | "en", key: string): string {
  const home = STRINGS[lang].home as unknown as Record<string, unknown>;
  // values_<i>_<field> → home.values[i][0 or 1]
  const arr = key.match(/^values_(\d+)_(title|body)$/);
  if (arr) {
    const i = Number(arr[1]);
    const slot = arr[2] === "title" ? 0 : 1;
    const v = (home.values as unknown as Array<[string, string]>)[i];
    return v?.[slot] ?? "";
  }
  const raw = home[key];
  return typeof raw === "string" ? raw : "";
}

export default async function HomeContentEditor() {
  const overrides = await getPageContentBilingual("home");

  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Accueil</h1>
      <p className="admin-sub">
        Chaque champ accepte une version française et anglaise. Vidée, la valeur par défaut du designer revient.
        Tout est enregistré automatiquement.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <Link href="/" target="_blank" className="admin-btn ghost" style={{ fontSize: 11 }}>
          VOIR LA PAGE ↗
        </Link>
      </div>

      <div className="admin-card">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <div className="content-section-head">
              <h2>{section.title}</h2>
              {section.description && <p>{section.description}</p>}
            </div>
            {section.fields.map((f) => (
              <ContentField
                key={f.key}
                page="home"
                fieldKey={f.key}
                label={f.label}
                variant={f.variant}
                hint={f.hint}
                initialFr={overrides.fr[f.key] ?? ""}
                initialEn={overrides.en[f.key] ?? ""}
                defaultFr={getDefault("fr", f.key)}
                defaultEn={getDefault("en", f.key)}
                saveAction={saveContentField}
              />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
