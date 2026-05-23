import { cookies, headers } from "next/headers";
import { isLang, type Lang } from "@/lib/i18n";

export const LANG_COOKIE = "lang";

/**
 * Read the lang cookie at request time. This makes the calling page DYNAMIC,
 * which is too expensive on Vercel hobby for public pages. Prefer
 * `defaultPublicLang()` for public pages and let a small client component
 * swap to EN after hydration if the visitor has the cookie set.
 */
export function getLangFromCookies(): Lang {
  const c = cookies().get(LANG_COOKIE)?.value;
  return isLang(c) ? c : "fr";
}

/**
 * Default language for SSR/static rendering of public pages. We always render FR
 * (the main market). A client component reads the cookie after hydration and
 * swaps to EN if needed, without blocking the initial render or breaking caching.
 */
export function defaultPublicLang(): Lang {
  return "fr";
}

/**
 * Best-effort detection via the Accept-Language header — doesn't depend on
 * cookies, so it CAN be used in pages that should remain static-ish (the
 * router will then generate per-locale variants on demand).
 */
export function detectLangFromAcceptLanguage(): Lang {
  const al = headers().get("accept-language") || "";
  return al.toLowerCase().startsWith("en") ? "en" : "fr";
}
