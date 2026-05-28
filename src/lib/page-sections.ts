/**
 * Custom page sections — the "modular blocks" feature.
 *
 * Each row in `page_sections` is a free-form section the photographer
 * added at the bottom of a fixed page (typically /, but the design is
 * page-agnostic). Its `type` tells the renderer which component to use
 * and which shape of `data` to expect. We deliberately keep the field
 * set small and luxurious — full Elementor would take weeks to ship.
 *
 * Section types (kept in sync with the renderer + admin editor):
 *   • "text"        — eyebrow + title + body, centered, on cream
 *   • "text-image"  — image left or right, eyebrow/title/body + button
 *   • "quote"       — large italic quote with attribution, sage band
 *   • "full-image"  — edge-to-edge photo + optional caption underneath
 */
import { query, queryOne, execute } from "@/lib/db";

export type SectionType = "text" | "text-image" | "quote" | "full-image";

// ── Per-type data shape. Stored as JSONB in Postgres. ─────────────────
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
  image_focal?: string; // CSS object-position
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
  data: SectionData;
};

export async function listSectionsForPage(page: string): Promise<PageSection[]> {
  return query<PageSection>(
    "SELECT id, page, position, type, data FROM page_sections WHERE page = $1 ORDER BY position ASC, id ASC",
    [page]
  );
}

export async function getSection(id: number): Promise<PageSection | null> {
  return queryOne<PageSection>(
    "SELECT id, page, position, type, data FROM page_sections WHERE id = $1",
    [id]
  );
}

export async function createSection(
  page: string,
  type: SectionType,
  data: SectionData
): Promise<number> {
  const r = await queryOne<{ id: number }>(
    `INSERT INTO page_sections (page, position, type, data)
     VALUES ($1, COALESCE((SELECT MAX(position) + 1 FROM page_sections WHERE page = $1), 0), $2, $3::jsonb)
     RETURNING id`,
    [page, type, JSON.stringify(data)]
  );
  return r?.id ?? 0;
}

export async function updateSectionData(id: number, data: SectionData): Promise<void> {
  await execute(
    "UPDATE page_sections SET data = $1::jsonb, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(data), id]
  );
}

export async function deleteSection(id: number): Promise<void> {
  await execute("DELETE FROM page_sections WHERE id = $1", [id]);
}

/**
 * Swap two sibling sections' positions. Used by the up/down arrows in
 * the admin editor.
 */
export async function swapSectionPositions(
  aId: number,
  bId: number
): Promise<void> {
  const a = await getSection(aId);
  const b = await getSection(bId);
  if (!a || !b) return;
  await execute("UPDATE page_sections SET position = $1 WHERE id = $2", [b.position, a.id]);
  await execute("UPDATE page_sections SET position = $1 WHERE id = $2", [a.position, b.id]);
}
