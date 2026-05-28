/**
 * Pure-types module — safe to import from both server and client.
 *
 * The full lib/page-sections.ts pulls in pg / @/lib/db, which webpack
 * refuses to bundle into client components. This file only exports
 * shapes and constants so client components (the SectionsEditor) can
 * use them without dragging pg through the browser bundle.
 */

export type SectionType = "text" | "text-image" | "quote" | "full-image";

export type SectionSlot =
  | "top"
  | "after-hero"
  | "after-values"
  | "after-featured"
  | "after-quote"
  | "bottom";

export const SLOT_LABELS: Record<SectionSlot, string> = {
  "top":             "Tout en haut (au-dessus du bandeau d'accueil)",
  "after-hero":      "Après le bandeau d'accueil",
  "after-values":    "Après la bande des valeurs",
  "after-featured":  "Après les mariages à la une",
  "after-quote":     "Après la bande citation",
  "bottom":          "Tout en bas (par défaut)",
};

export const SLOT_ORDER: SectionSlot[] = [
  "top", "after-hero", "after-values", "after-featured", "after-quote", "bottom",
];

// Per-type data shapes (JSONB column shape).
export type TextSectionData = {
  eyebrow_fr?: string;
  eyebrow_en?: string;
  title_fr?: string;
  title_en?: string;
  body_fr?: string;
  body_en?: string;
  align?: "center" | "left";
  background?: "cream" | "cream-deep" | "white";
};
export type TextImageSectionData = {
  image_url?: string;
  image_position?: "left" | "right";
  image_focal?: string;
  eyebrow_fr?: string;
  eyebrow_en?: string;
  title_fr?: string;
  title_en?: string;
  body_fr?: string;
  body_en?: string;
  cta_label_fr?: string;
  cta_label_en?: string;
  cta_href?: string;
};
export type QuoteSectionData = {
  quote_fr?: string;
  quote_en?: string;
  author?: string;
};
export type FullImageSectionData = {
  image_url?: string;
  image_focal?: string;
  caption_fr?: string;
  caption_en?: string;
};
export type SectionData =
  | TextSectionData
  | TextImageSectionData
  | QuoteSectionData
  | FullImageSectionData;

export type PageSection = {
  id: number;
  page: string;
  position: number;
  type: SectionType;
  slot: SectionSlot;
  data: SectionData;
};
