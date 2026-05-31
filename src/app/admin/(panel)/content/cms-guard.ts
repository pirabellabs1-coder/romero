import { notFound } from "next/navigation";

/**
 * CMS page visibility gate.
 *
 * We've built editors for 9 pages but only want the client (the
 * photographer) to discover the Home editor right now — the others
 * land in their next review window. The pages and code stay shipped;
 * this guard returns 404 for any non-allowed slug so direct URL typing
 * doesn't bypass the listing on /admin/content.
 *
 * To re-enable a page later: add its slug to ALLOWED.
 */
const ALLOWED = new Set<string>([
  "home",
  "about",
  "portfolio",
  "blog",
  "reviews",
  "contact",
  "services",
  "nav",
  "footer",
]);

export function cmsPageGuard(slug: string): void {
  if (!ALLOWED.has(slug)) notFound();
}
