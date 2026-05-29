# Romero Photography — Hand-off notes

Updated when the photographer is back from her 10-day client review.

## What's live and working

### Public site (`romerophotography.fr`)
- 7 main pages (`/`, `/a-propos`, `/prestations`, `/portfolio`, `/portfolio/[slug]`, `/blog`, `/blog/[slug]`, `/avis`, `/contact`, `/mentions-legales`, `/politique-confidentialite`) — all dynamic, all returning 200, all reading from Supabase Postgres.
- Custom CMS sections render at 6 insertion points on the home page when present.

### Admin panel (`/admin`)
- Auth: `requireUser()` middleware, session cookie.
- Galleries: list, edit, photos with focal point + cover position. Upload pattern is client → Blob direct (bypasses Vercel 4.5 MB cap).
- Posts (blog): same upload + cover picker pattern.
- Reviews, Messages, Mail preview, Settings, Design, Account — unchanged from initial scope.

### CMS (`/admin/content`)
**Visible to the client today**: only the Home editor.
**Hidden behind `cmsPageGuard`** until next iteration: About, Portfolio, Blog, Reviews, Contact, Services, Nav, Footer. All editors are built, deployed, and tagged for cache invalidation — just gated.

## To re-enable hidden pages

Edit two files:

### 1. `src/app/admin/(panel)/content/cms-guard.ts`
```ts
const ALLOWED = new Set<string>([
  "home",
  // Uncomment each as you want it visible:
  // "about", "portfolio", "blog", "reviews", "contact", "services", "nav", "footer",
]);
```

### 2. `src/app/admin/(panel)/content/page.tsx`
Look for:
```ts
const ready = ["home"].includes(p.slug);
```
Add the same slugs.

That's it — `git push` and they're live.

## Architecture key points

### Database (Supabase Postgres)
- Connection pooler: `aws-1-eu-north-1.pooler.supabase.com:6543` (transaction mode, max 1 connection per warm lambda).
- `DATABASE_URL` env var on Vercel.
- Tables: `users`, `settings`, `galleries`, `photos`, `posts`, `reviews`, `messages`, `page_content`, `page_sections`.

### Photo storage (Vercel Blob)
- Uploaded via `@vercel/blob/client` from the browser → `/api/blob/upload-token` mints a signed token → file goes straight to Blob.
- Pathnames: `galleries/g<id>/...` and `posts/...`.

### Caching layer (Next.js `unstable_cache`)
- `getPageContent(page, lang)` → tag `cms-content`. Invalidated by `setPageContent`.
- `listSectionsForSlot(page, slot)` → tag `cms-sections`. Invalidated by create/update/delete/swap/setSlot.
- `getSettings()` → 5 s in-memory cache in `lib/settings.ts`.

### CMS edits → public visibility
1. Admin saves a field → `setPageContent(...)` → `revalidateTag('cms-content')` → next public render reads fresh.
2. Admin saves a section → `createSection / updateSectionData / deleteSection / etc.` → `revalidateTag('cms-sections')` → same.
3. Belt-and-suspenders: each action also calls `revalidatePath('/')` (and friends) so even if the tag layer hiccups, the page cache is invalidated.

## Verification scripts

Run anytime from the project root:

```bash
node supabase/health-check.js   # full smoke + DB integrity + latency check
node supabase/verify-e2e.js     # end-to-end: write a cover, verify site reflects it, restore
node supabase/verify-dashboard.js  # confirms every admin dashboard query returns sane data
```

## Environment variables (Vercel)

- `DATABASE_URL` — Supabase Postgres connection string (pooler mode).
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob token.
- `NEXT_PUBLIC_SITE_URL` — `https://romerophotography.fr`.
- `AUTH_SECRET` — session cookie signing secret.
- `MAIL_TO`, `MAIL_FROM`, `RESEND_API_KEY` — contact form delivery.

## Known things to consider later

- The `pickShowcasePhotos` function is called on /a-propos and /prestations to pick random photos from the pool. Not cached. Cheap-ish but could be cached if perf becomes an issue.
- `listGalleries({featuredOnly: true})` is called by both the home and content/home editor. Two roundtrips. Could be cached for the home but the admin needs fresh.
- The cold-start lambda still pays ~1s setup time. Vercel Fluid Compute would help but requires a non-trivial migration.

## Commits worth knowing

Recent feature commits (newest first):
- `feat(cms): éditeur de contenu pour les 8 pages restantes`
- `feat(cms/sections): 6 emplacements (slots) sur la home + déplacement libre`
- `feat(cms): sections modulaires (Elementor light)`
- `feat(cms): éditeur de contenu live — page Accueil (FR + EN)`
- `fix(uploads): client → Blob direct (contourne le cap 4.5 MB de Vercel)`
- `feat(db): migration complète SQLite+Blob → Supabase Postgres`
