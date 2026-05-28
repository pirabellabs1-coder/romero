/**
 * Page content overrides — the CMS layer on top of the i18n defaults.
 *
 * Every page has a hardcoded set of strings in `lib/i18n.ts` (the
 * "factory defaults"). For any string the photographer wants to edit
 * herself, we look up `page_content(page, key, lang)` in the DB and
 * use that value if present. If the row doesn't exist, the i18n
 * default wins. This means:
 *   • A brand-new install renders exactly as the designer intended.
 *   • Any edit she makes survives forever in Postgres.
 *   • If she clears a field, the default comes back automatically.
 */
import { query, execute } from "@/lib/db";
import type { Lang } from "@/lib/i18n";

export type ContentRow = { key: string; value: string };

/** Fetch every override for a given page+lang, as a plain object. */
export async function getPageContent(
  page: string,
  lang: Lang
): Promise<Record<string, string>> {
  const rows = await query<ContentRow>(
    "SELECT key, value FROM page_content WHERE page = $1 AND lang = $2",
    [page, lang]
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Fetch overrides for BOTH languages in one round-trip. Used by the
 * admin editor which displays FR + EN side by side.
 */
export async function getPageContentBilingual(
  page: string
): Promise<{ fr: Record<string, string>; en: Record<string, string> }> {
  const rows = await query<{ key: string; lang: string; value: string }>(
    "SELECT key, lang, value FROM page_content WHERE page = $1",
    [page]
  );
  const fr: Record<string, string> = {};
  const en: Record<string, string> = {};
  for (const r of rows) {
    if (r.lang === "fr") fr[r.key] = r.value;
    else if (r.lang === "en") en[r.key] = r.value;
  }
  return { fr, en };
}

/**
 * Upsert a single override. Setting `value` to an empty string deletes
 * the row so the i18n default comes back — that's the "reset to default"
 * pattern, no separate action needed.
 */
export async function setPageContent(
  page: string,
  key: string,
  lang: Lang,
  value: string
): Promise<void> {
  if (value === "") {
    await execute(
      "DELETE FROM page_content WHERE page = $1 AND key = $2 AND lang = $3",
      [page, key, lang]
    );
    return;
  }
  await execute(
    `INSERT INTO page_content (page, key, lang, value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (page, key, lang)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [page, key, lang, value]
  );
}
