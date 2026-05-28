"use server";
import { revalidatePath } from "next/cache";
import { setPageContent } from "@/lib/page-content";
import { requireUser } from "@/lib/auth";

const PAGE_TO_PATH: Record<string, string[]> = {
  home: ["/"],
  about: ["/a-propos"],
  services: ["/prestations"],
  portfolio: ["/portfolio"],
  blog: ["/blog"],
  reviews: ["/avis"],
  contact: ["/contact"],
  nav: ["/", "/a-propos", "/prestations", "/portfolio", "/blog", "/avis", "/contact"],
  footer: ["/", "/a-propos", "/prestations", "/portfolio", "/blog", "/avis", "/contact"],
};

function revalidateForPage(page: string) {
  const paths = PAGE_TO_PATH[page] || [];
  for (const p of paths) revalidatePath(p);
  revalidatePath(`/admin/content/${page}`);
}

/**
 * Save a one-off photo URL for a page section (e.g. home hero). Stored
 * in page_content with lang='fr' since the same image is used in both
 * locales. Use saveContentFields for plain text.
 */
export async function saveContentPhoto(
  page: string,
  key: string,
  url: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    if (!/^https?:\/\/.+|^\/uploads\//.test(url)) {
      return { ok: false, error: "URL non reconnue" };
    }
    await setPageContent(page, key, "fr", url);
    revalidateForPage(page);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ContentEdit = { key: string; lang: "fr" | "en"; value: string };

/**
 * Bulk-save every text field the photographer changed since the last
 * save. Empty values delete the override row → the i18n default kicks
 * back in. Returns ok/error so the editor can render a Save status.
 */
export async function saveContentFields(
  page: string,
  edits: ContentEdit[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    requireUser();
    let count = 0;
    for (const e of edits) {
      if (e.lang !== "fr" && e.lang !== "en") continue;
      if (typeof e.key !== "string" || !e.key) continue;
      const value = typeof e.value === "string" ? e.value : "";
      await setPageContent(page, e.key, e.lang, value);
      count++;
    }
    revalidateForPage(page);
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Live-save a single content field. Called by the inline-editing UI on
 * every blur (or after a short debounce). Returns ok/error so the client
 * can show "✓ Enregistré" or "❌ <err>" next to the field.
 *
 * Setting value to "" removes the override → the factory default in
 * lib/i18n.ts becomes visible again. This is also the "reset to default"
 * button's job.
 */
export async function saveContentField(
  page: string,
  key: string,
  lang: "fr" | "en",
  value: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    await setPageContent(page, key, lang, value);
    // Invalidate the affected public route. We map page slugs → URL paths
    // so the photographer sees her edit live immediately.
    const PAGE_TO_PATH: Record<string, string[]> = {
      home: ["/"],
      about: ["/a-propos"],
      services: ["/prestations"],
      portfolio: ["/portfolio"],
      blog: ["/blog"],
      reviews: ["/avis"],
      contact: ["/contact"],
      nav: ["/", "/a-propos", "/prestations", "/portfolio", "/blog", "/avis", "/contact"],
      footer: ["/", "/a-propos", "/prestations", "/portfolio", "/blog", "/avis", "/contact"],
    };
    const paths = PAGE_TO_PATH[page] || [];
    for (const p of paths) revalidatePath(p);
    revalidatePath(`/admin/content/${page}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
