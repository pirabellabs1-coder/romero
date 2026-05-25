import { getDb } from "@/lib/db";
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

export function listGalleries(opts: { featuredOnly?: boolean; includeDrafts?: boolean } = {}): GalleryRow[] {
  const conditions: string[] = [];
  if (!opts.includeDrafts) conditions.push("g.published = 1");
  if (opts.featuredOnly) conditions.push("g.featured = 1");
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT g.*, p.filename AS cover_filename
    FROM galleries g
    LEFT JOIN photos p ON p.id = g.cover_photo_id
    ${whereClause}
    ORDER BY g.sort_order ASC, g.id ASC
  `;
  return getDb().prepare(sql).all() as GalleryRow[];
}

export function getGallery(slug: string): GalleryRow | null {
  return (getDb()
    .prepare(`
      SELECT g.*, p.filename AS cover_filename
      FROM galleries g
      LEFT JOIN photos p ON p.id = g.cover_photo_id
      WHERE g.slug = ? AND g.published = 1
    `)
    .get(slug) as GalleryRow) ?? null;
}

export function getGalleryById(id: number): GalleryRow | null {
  return (getDb()
    .prepare(`
      SELECT g.*, p.filename AS cover_filename
      FROM galleries g
      LEFT JOIN photos p ON p.id = g.cover_photo_id
      WHERE g.id = ?
    `)
    .get(id) as GalleryRow) ?? null;
}

export type PhotoRow = {
  id: number;
  gallery_id: number | null;
  filename: string;
  alt: string;
  span: string;
  sort_order: number;
};

export function listPhotosForGallery(galleryId: number): PhotoRow[] {
  return getDb()
    .prepare("SELECT * FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, id ASC")
    .all(galleryId) as PhotoRow[];
}

// Re-export the pure helper so server-side callers can keep importing it
// from "@/lib/content". Client components must import from "@/lib/photo-url"
// directly to avoid pulling in DB/fs dependencies.
export { photoUrl } from "@/lib/photo-url";
import { photoUrl } from "@/lib/photo-url";

/**
 * For grid/teaser views: return a usable cover URL for the gallery.
 * If the stored cover is the seed placeholder (hero.jpg), substitute it with
 * a deterministic photo from the pool so grids look varied. The actual gallery
 * detail page should use the raw `cover_filename` to stay honest.
 */
export function coverFor(g: GalleryRow, seed: string): string {
  if (g.cover_filename && g.cover_filename !== "hero.jpg") {
    return photoUrl(g.cover_filename)!;
  }
  const pool = pickShowcasePhotos(1, seed);
  return pool[0] ? photoUrl(pool[0])! : "/uploads/hero.jpg";
}

/**
 * Pick N photos from the published gallery pool, distributed across galleries
 * so consecutive picks come from DIFFERENT weddings (round-robin), with a
 * seed-derived starting offset for cross-page variety.
 *
 * - Within a single call: photos are distinct AND span as many galleries as possible
 * - Same seed: stable ordering across page renders
 * - Different seeds: different starting offsets → different photo selection
 */
export function pickShowcasePhotos(n: number, seed: string = "default"): string[] {
  const rows = getDb()
    .prepare(`
      SELECT p.gallery_id, p.filename
      FROM photos p
      JOIN galleries g ON g.id = p.gallery_id
      WHERE g.published = 1 AND p.filename != 'hero.jpg'
      ORDER BY p.gallery_id ASC, p.sort_order ASC, p.id ASC
    `)
    .all() as { gallery_id: number; filename: string }[];
  if (rows.length === 0) return [];

  // Group by gallery, then shuffle each queue with the seed so different seeds
  // surface different photos from the same gallery.
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

  // Shuffle the order of galleries too, so the FIRST pick varies per seed
  for (let i = queues.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [queues[i], queues[j]] = [queues[j], queues[i]];
  }

  // Round-robin: one photo from each gallery in rotation
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
  // FNV-1a 32-bit
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

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed));
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
  published_at: string;
  read_minutes: number;
  sort_order: number;
  published: number;
};

export function listPosts(opts: { includeDrafts?: boolean } = {}): PostRow[] {
  const where = opts.includeDrafts ? "" : "WHERE published = 1";
  return getDb()
    .prepare(`SELECT * FROM posts ${where} ORDER BY published_at DESC, id DESC`)
    .all() as PostRow[];
}

export function getPost(slug: string): PostRow | null {
  return (getDb().prepare("SELECT * FROM posts WHERE slug = ?").get(slug) as PostRow) ?? null;
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

export function listReviews(opts: { includeHidden?: boolean } = {}): ReviewRow[] {
  const where = opts.includeHidden ? "" : "WHERE published = 1";
  return getDb()
    .prepare(`SELECT * FROM reviews ${where} ORDER BY sort_order ASC, id ASC`)
    .all() as ReviewRow[];
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
