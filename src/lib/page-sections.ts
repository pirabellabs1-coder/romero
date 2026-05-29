/**
 * Custom page sections — the "modular blocks" feature.
 *
 * Each row in `page_sections` is a free-form section the photographer
 * added at one of the page's insertion slots. Its `type` tells the
 * renderer which component to use and which shape of `data` to expect.
 *
 * Types and constants live in `page-sections-types.ts` so client
 * components can import them without dragging pg into the bundle.
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { query, queryOne, execute } from "@/lib/db";

export const SECTIONS_TAG = "cms-sections";

export {
  SLOT_LABELS,
  SLOT_ORDER,
} from "@/lib/page-sections-types";

export type {
  SectionType,
  SectionSlot,
  TextSectionData,
  TextImageSectionData,
  QuoteSectionData,
  FullImageSectionData,
  SectionData,
  PageSection,
} from "@/lib/page-sections-types";

import type {
  SectionType,
  SectionSlot,
  SectionData,
  PageSection,
} from "@/lib/page-sections-types";

/** Admin read — never cached so the editor reflects DB exactly. */
export async function listSectionsForPage(page: string): Promise<PageSection[]> {
  return query<PageSection>(
    "SELECT id, page, position, type, slot, data FROM page_sections WHERE page = $1 ORDER BY position ASC, id ASC",
    [page]
  );
}

/**
 * Public read — used at each insertion point on every page render.
 * Cached + tagged so the admin's add/edit/delete/move actions show up
 * immediately via revalidateTag(SECTIONS_TAG).
 */
export const listSectionsForSlot: (page: string, slot: SectionSlot) => Promise<PageSection[]> = unstable_cache(
  async (page: string, slot: SectionSlot): Promise<PageSection[]> => {
    return query<PageSection>(
      "SELECT id, page, position, type, slot, data FROM page_sections WHERE page = $1 AND slot = $2 ORDER BY position ASC, id ASC",
      [page, slot]
    );
  },
  ["page-sections-by-page-slot"],
  { revalidate: 300, tags: [SECTIONS_TAG] }
);

export async function getSection(id: number): Promise<PageSection | null> {
  return queryOne<PageSection>(
    "SELECT id, page, position, type, slot, data FROM page_sections WHERE id = $1",
    [id]
  );
}

export async function createSection(
  page: string,
  type: SectionType,
  slot: SectionSlot,
  data: SectionData
): Promise<number> {
  const r = await queryOne<{ id: number }>(
    `INSERT INTO page_sections (page, slot, position, type, data)
     VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM page_sections WHERE page = $1 AND slot = $2), 0), $3, $4::jsonb)
     RETURNING id`,
    [page, slot, type, JSON.stringify(data)]
  );
  revalidateTag(SECTIONS_TAG);
  return r?.id ?? 0;
}

export async function setSectionSlot(id: number, slot: SectionSlot): Promise<void> {
  await execute(
    `UPDATE page_sections SET slot = $1,
       position = COALESCE((SELECT MAX(position) + 1 FROM page_sections WHERE page = (SELECT page FROM page_sections WHERE id = $2) AND slot = $1), 0),
       updated_at = NOW()
     WHERE id = $2`,
    [slot, id]
  );
  revalidateTag(SECTIONS_TAG);
}

export async function updateSectionData(id: number, data: SectionData): Promise<void> {
  await execute(
    "UPDATE page_sections SET data = $1::jsonb, updated_at = NOW() WHERE id = $2",
    [JSON.stringify(data), id]
  );
  revalidateTag(SECTIONS_TAG);
}

export async function deleteSection(id: number): Promise<void> {
  await execute("DELETE FROM page_sections WHERE id = $1", [id]);
  revalidateTag(SECTIONS_TAG);
}

export async function swapSectionPositions(aId: number, bId: number): Promise<void> {
  const a = await getSection(aId);
  const b = await getSection(bId);
  if (!a || !b) return;
  await execute("UPDATE page_sections SET position = $1 WHERE id = $2", [b.position, a.id]);
  await execute("UPDATE page_sections SET position = $1 WHERE id = $2", [a.position, b.id]);
  revalidateTag(SECTIONS_TAG);
}
