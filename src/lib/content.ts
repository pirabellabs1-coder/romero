import { query, queryOne } from "@/lib/db";
import type { Lang } from "@/lib/i18n";

export type GalleryRow = {
  id: number;
  slug: string;
  names: string;
  place: string;
  date_label: string;
  region: string;
  kind: string;
  intro_fr: string;
  intro_en: string;
  cover_photo_id: number | null;
  featured: number;
  sort_order: number;
  published: number;
  cover_filename: string | null;
};

export async function listGalleries(
  opts: { featuredOnly?: boolean; includeDrafts?: boolean } = {}
): Promise<GalleryRow[]> {
  const conditions: string[] = [];
  if (!opts.includeDrafts) conditions.push("g.published = 1");
  if (opts.featuredOnly) conditions.push("g.featured = 1");
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return query<GalleryRow>(`
    SELECT g.*, p.filename AS cover_filename
    FROM galleries g
    LEFT JOIN photos p ON p.id = g.cover_photo_id
    ${whereClause}
    ORDER BY g.sort_order ASC, g.id ASC
  `);
}

export async function getGallery(slug: string): Promise<GalleryRow | null> {
  return queryOne<GalleryRow>(
    `SELECT g.*, p.filename AS cover_filename
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.cover_photo_id
     WHERE g.slug = $1 AND g.published = 1`,
    [slug]
  );
}

export async function getGalleryById(id: number): Promise<GalleryRow | null> {
  return queryOne<GalleryRow>(
    `SELECT g.*, p.filename AS cover_filename
     FROM galleries g
     LEFT JOIN photos p ON p.id = g.cover_photo_id
     WHERE g.id = $1`,
    [id]
  );
}

export type PhotoRow = {
  id: number;
  gallery_id: number | null;
  filename: string;
  alt: string;
  span: string;
  sort_order: number;
};

export async function listPhotosForGallery(galleryId: number): Promise<PhotoRow[]> {
  return query<PhotoRow>(
    "SELECT * FROM photos WHERE gallery_id = $1 ORDER BY sort_order ASC, id ASC",
    [galleryId]
  );
}

// Re-export the pure helper so server-side callers can keep importing it
// from "@/lib/content". Client components must import from "@/lib/photo-url"
// directly to avoid pulling in DB dependencies.
export { photoUrl } from "@/lib/photo-url";
import { photoUrl } from "@/lib/photo-url";

/**
 * Return a usable cover URL for the gallery.
 *
 * Honesty rule: the admin dashboard and the public site MUST show the same
 * photo for a given gallery. We used to substitute hero.jpg with a random
 * photo from another gallery for "variety" — that produced the bug where
 * the photographer saw hero.jpg on /admin but a stranger's wedding on /.
 *
 * Fallback chain:
 *   1. The admin-chosen cover_filename (if not the hero placeholder)
 *   2. The first real photo of this same gallery (any non-hero photo)
 *   3. The hero placeholder, as last resort
 *
 * `seed` is kept for API compatibility but no longer used.
 */
export async function coverFor(g: GalleryRow, _seed: string): Promise<string> {
  if (g.cover_filename && g.cover_filename !== "hero.jpg") {
    return photoUrl(g.cover_filename)!;
  }
  // Try the gallery's own first real photo before falling back to hero.
  const own = await queryOne<{ filename: string }>(
    "SELECT filename FROM photos WHERE gallery_id = $1 AND filename != 'hero.jpg' ORDER BY sort_order ASC, id ASC LIMIT 1",
    [g.id]
  );
  if (own?.filename) return photoUrl(own.filename)!;
  return "/uploads/hero.jpg";
}

/**
 * Pick N photos from the published gallery pool, distributed across galleries
 * so consecutive picks come from DIFFERENT weddings (round-robin), with a
 * seed-derived starting offset for cross-page variety.
 */
export async function pickShowcasePhotos(n: number, seed: string = "default"): Promise<string[]> {
  const rows = await query<{ gallery_id: number; filename: string }>(
    `SELECT p.gallery_id, p.filename
     FROM photos p
     JOIN galleries g ON g.id = p.gallery_id
     WHERE g.published = 1 AND p.filename != 'hero.jpg'
     ORDER BY p.gallery_id ASC, p.sort_order ASC, p.id ASC`
  );
  if (rows.length === 0) return [];

  const rng = mulberry32(hashString(seed));
  const byGallery = new Map<number, string[]>();
  for (const r of rows) {
    if (!byGallery.has(r.gallery_id)) byGallery.set(r.gallery_id, []);
    byGallery.get(r.gallery_id)!.push(r.filename);
  }
  const queues = Array.from(byGallery.values()).map((q) => {
    const c = q.slice();
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  });

  for (let i = queues.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [queues[i], queues[j]] = [queues[j], queues[i]];
  }

  const interleaved: string[] = [];
  while (queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      if (q.length > 0) interleaved.push(q.shift()!);
    }
  }

  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(interleaved[i % interleaved.length]);
  return out;
}

// ---- Seeded RNG helpers (no deps, deterministic) ----

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PostRow = {
  id: number;
  slug: string;
  title_fr: string;
  title_en: string;
  category: string;
  excerpt_fr: string;
  excerpt_en: string;
  body_fr: string;
  body_en: string;
  cover_filename: string | null;
  cover_position: string;
  published_at: string;
  read_minutes: number;
  sort_order: number;
  published: number;
};

export async function listPosts(opts: { includeDrafts?: boolean } = {}): Promise<PostRow[]> {
  const where = opts.includeDrafts ? "" : "WHERE published = 1";
  return query<PostRow>(
    `SELECT * FROM posts ${where} ORDER BY published_at DESC, id DESC`
  );
}

export async function getPost(slug: string): Promise<PostRow | null> {
  return queryOne<PostRow>("SELECT * FROM posts WHERE slug = $1", [slug]);
}

export type ReviewRow = {
  id: number;
  name: string;
  date_label: string;
  rating: number;
  text_fr: string;
  text_en: string;
  sort_order: number;
  published: number;
};

export async function listReviews(opts: { includeHidden?: boolean } = {}): Promise<ReviewRow[]> {
  const where = opts.includeHidden ? "" : "WHERE published = 1";
  return query<ReviewRow>(
    `SELECT * FROM reviews ${where} ORDER BY sort_order ASC, id ASC`
  );
}

export function reviewText(r: ReviewRow, lang: Lang): string {
  return lang === "en" && r.text_en ? r.text_en : r.text_fr;
}

export function postTitle(p: PostRow, lang: Lang): string {
  return lang === "en" && p.title_en ? p.title_en : p.title_fr;
}

export function postExcerpt(p: PostRow, lang: Lang): string {
  return lang === "en" && p.excerpt_en ? p.excerpt_en : p.excerpt_fr;
}

export function galleryIntro(g: GalleryRow, lang: Lang): string {
  return lang === "en" && g.intro_en ? g.intro_en : g.intro_fr;
}
