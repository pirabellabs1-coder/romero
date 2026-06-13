"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { put, del } from "@vercel/blob";
import { query, queryOne, execute, pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sanitizePosition } from "@/lib/cover-position";

const MAX_DIM = 2200;
const WEBP_QUALITY = 80;
// Hard cap on individual file size — DoS protection. 25 MB is more than
// enough for any reasonable photo coming off a modern camera once
// resized to MAX_DIM. Anything bigger is rejected before we even pipe
// it through sharp.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const GALS_DIR = path.join(UPLOADS_DIR, "galleries");

// Use Vercel Blob in production (filesystem is read-only there). Dev keeps
// the local public/uploads folder so the developer can iterate without
// touching cloud storage.
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function ensureDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(GALS_DIR)) fs.mkdirSync(GALS_DIR, { recursive: true });
}

// A stored filename can be either a relative local path (e.g.
// "galleries/g2/foo.webp") or a full Blob URL ("https://...blob...webp").
function isBlobUrl(filename: string): boolean {
  return filename.startsWith("https://") || filename.startsWith("http://");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function createGallery(formData: FormData) {
  requireUser();
  const names = String(formData.get("names") || "").trim();
  const place = String(formData.get("place") || "").trim();
  if (!names || !place) return;
  const baseSlug = slugify(names) || "galerie";
  let slug = baseSlug;
  let i = 1;
  while ((await queryOne<{ x: number }>("SELECT 1 AS x FROM galleries WHERE slug = $1", [slug])) !== null) {
    slug = `${baseSlug}-${i++}`;
  }
  const r = await queryOne<{ id: number }>(
    `INSERT INTO galleries (slug, names, place, date_label, region, kind, intro_fr, intro_en, featured, published, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, '', '', 0, 1, COALESCE((SELECT MAX(sort_order)+1 FROM galleries), 0))
     RETURNING id`,
    [
      slug,
      names,
      place,
      String(formData.get("date_label") || ""),
      String(formData.get("region") || "FRANCE"),
      String(formData.get("kind") || "MARIAGE"),
    ]
  );
  revalidatePath("/portfolio");
  revalidatePath("/");
  if (r?.id) redirect(`/admin/galleries/${r.id}`);
}

export async function updateGallery(id: number, formData: FormData) {
  requireUser();
  const featured = formData.get("featured") ? 1 : 0;
  const published = formData.get("published") ? 1 : 0;
  await execute(
    `UPDATE galleries SET names = $1, place = $2, date_label = $3, region = $4, kind = $5,
       intro_fr = $6, intro_en = $7, featured = $8, published = $9, sort_order = $10
     WHERE id = $11`,
    [
      String(formData.get("names") || "").trim(),
      String(formData.get("place") || "").trim(),
      String(formData.get("date_label") || ""),
      String(formData.get("region") || "FRANCE"),
      String(formData.get("kind") || "MARIAGE"),
      String(formData.get("intro_fr") || ""),
      String(formData.get("intro_en") || ""),
      featured,
      published,
      Number(formData.get("sort_order") || 0),
      id,
    ]
  );
  revalidatePath("/portfolio");
  const slug = (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [id]))?.slug;
  if (slug) revalidatePath(`/portfolio/${slug}`);
  revalidatePath("/");
  redirect(`/admin/galleries/${id}?ok=saved`);
}

export async function deleteGallery(id: number) {
  requireUser();
  const photos = await query<{ filename: string }>(
    "SELECT filename FROM photos WHERE gallery_id = $1",
    [id]
  );
  for (const p of photos) {
    if (p.filename.startsWith("hero")) continue;
    if (isBlobUrl(p.filename)) {
      if (USE_BLOB) {
        try { await del(p.filename); } catch {}
      }
    } else {
      const fp = path.join(UPLOADS_DIR, p.filename);
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch {}
      }
    }
  }
  // FK is ON DELETE CASCADE on photos.gallery_id, but we still NULL the
  // self-reference first to be explicit about the order.
  await execute("UPDATE galleries SET cover_photo_id = NULL WHERE id = $1", [id]);
  await execute("DELETE FROM galleries WHERE id = $1", [id]);
  revalidatePath("/portfolio");
  revalidatePath("/");
  redirect("/admin/galleries?ok=deleted");
}

export type UploadResult = {
  inserted: number;
  skipped: { name: string; reason: string }[];
  errors: { name: string; message: string }[];
};

/**
 * Called by UploadDropzone after the client has uploaded each file directly
 * to Vercel Blob via `@vercel/blob/client`. The payload is just a list of
 * Blob URLs — no file bytes flow through this Server Action, so the 4.5 MB
 * Vercel serverless body cap is irrelevant. This is the modern, scalable
 * pattern for media uploads on Vercel.
 */
export async function registerUploadedPhotos(
  galleryId: number,
  uploads: { url: string; name: string }[]
): Promise<UploadResult> {
  requireUser();
  const result: UploadResult = { inserted: 0, skipped: [], errors: [] };
  if (!uploads || uploads.length === 0) return result;

  const insertedIds: number[] = [];
  for (const u of uploads) {
    try {
      if (!u.url || !/^https?:\/\/.+/i.test(u.url)) {
        result.errors.push({ name: u.name || u.url, message: "URL Blob invalide." });
        continue;
      }
      const row = await queryOne<{ id: number }>(
        `INSERT INTO photos (gallery_id, filename, alt, span, sort_order)
         VALUES ($1, $2, '', '', COALESCE((SELECT MAX(sort_order)+1 FROM photos WHERE gallery_id = $1), 0))
         RETURNING id`,
        [galleryId, u.url]
      );
      if (row?.id) {
        insertedIds.push(row.id);
        result.inserted += 1;
      }
    } catch (e) {
      result.errors.push({
        name: u.name || u.url,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Same auto-cover replacement logic as the legacy uploadPhoto path.
  const current = await queryOne<{ cover_photo_id: number | null; cover_filename: string | null }>(
    `SELECT g.cover_photo_id, p.filename AS cover_filename
     FROM galleries g LEFT JOIN photos p ON p.id = g.cover_photo_id
     WHERE g.id = $1`,
    [galleryId]
  );
  const coverIsMissingOrSeed =
    current && (current.cover_photo_id == null || current.cover_filename === "hero.jpg");
  if (coverIsMissingOrSeed && insertedIds.length > 0) {
    await execute("UPDATE galleries SET cover_photo_id = $1 WHERE id = $2", [
      insertedIds[0],
      galleryId,
    ]);
  }

  const slug = (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [galleryId]))?.slug;
  if (slug) revalidatePath(`/portfolio/${slug}`);
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/portfolio");
  revalidatePath("/");

  return result;
}

export async function uploadPhoto(galleryId: number, formData: FormData): Promise<UploadResult> {
  requireUser();
  const files = formData.getAll("files") as File[];
  const result: UploadResult = { inserted: 0, skipped: [], errors: [] };
  if (files.length === 0) {
    result.skipped.push({ name: "(aucun)", reason: "Aucun fichier reçu par le serveur." });
    return result;
  }
  const insertedIds: number[] = [];

  const galleryFolder = `galleries/g${galleryId}`;
  if (!USE_BLOB) {
    ensureDirs();
    const galleryAbs = path.join(UPLOADS_DIR, galleryFolder);
    if (!fs.existsSync(galleryAbs)) fs.mkdirSync(galleryAbs, { recursive: true });
  }

  for (const file of files) {
    const name = file instanceof File ? file.name : "(inconnu)";
    if (!(file instanceof File) || file.size === 0) {
      result.skipped.push({ name, reason: "Fichier vide." });
      continue;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      result.skipped.push({ name, reason: `Trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo > 25 Mo).` });
      continue;
    }
    const ext = path.extname(file.name).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
      result.skipped.push({ name, reason: `Format non pris en charge (${ext || "inconnu"}).` });
      continue;
    }

    try {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const buf = Buffer.from(await file.arrayBuffer());

      let webpBuf: Buffer;
      try {
        const img = sharp(buf).rotate();
        const meta = await img.metadata();
        const max = Math.max(meta.width || 0, meta.height || 0);
        let pipeline = img;
        if (max > MAX_DIM) {
          const w = (meta.width || 0) >= (meta.height || 0) ? MAX_DIM : undefined;
          const h = (meta.height || 0) > (meta.width || 0) ? MAX_DIM : undefined;
          pipeline = pipeline.resize({ width: w, height: h, fit: "inside", withoutEnlargement: true });
        }
        webpBuf = await pipeline.webp({ quality: WEBP_QUALITY, effort: 5 }).toBuffer();
      } catch {
        // Sharp failed (corrupt file, unsupported codec, etc.) — store raw.
        webpBuf = buf;
      }

      let storedFilename: string;
      if (USE_BLOB) {
        const blob = await put(`${galleryFolder}/p${ts}.webp`, webpBuf, {
          access: "public",
          contentType: "image/webp",
          addRandomSuffix: false,
        });
        storedFilename = blob.url;
      } else {
        const filename = `${galleryFolder}/p${ts}.webp`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), webpBuf);
        storedFilename = filename;
      }

      const row = await queryOne<{ id: number }>(
        `INSERT INTO photos (gallery_id, filename, alt, span, sort_order)
         VALUES ($1, $2, '', '', COALESCE((SELECT MAX(sort_order)+1 FROM photos WHERE gallery_id = $1), 0))
         RETURNING id`,
        [galleryId, storedFilename]
      );
      if (row?.id) {
        insertedIds.push(row.id);
        result.inserted += 1;
      }
    } catch (e) {
      result.errors.push({
        name,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Auto-set cover when:
  //   - the gallery has no cover yet, OR
  //   - the cover is the seed placeholder hero.jpg (so first real upload
  //     replaces it automatically — fixes the long-standing "Anastasia &
  //     Jordan still shows hero.jpg" issue).
  const current = await queryOne<{ cover_photo_id: number | null; cover_filename: string | null }>(
    `SELECT g.cover_photo_id, p.filename AS cover_filename
     FROM galleries g LEFT JOIN photos p ON p.id = g.cover_photo_id
     WHERE g.id = $1`,
    [galleryId]
  );
  const coverIsMissingOrSeed =
    current && (current.cover_photo_id == null || current.cover_filename === "hero.jpg");
  if (coverIsMissingOrSeed && insertedIds.length > 0) {
    await execute("UPDATE galleries SET cover_photo_id = $1 WHERE id = $2", [
      insertedIds[0],
      galleryId,
    ]);
  }

  const slug = (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [galleryId]))?.slug;
  if (slug) revalidatePath(`/portfolio/${slug}`);
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/portfolio");
  revalidatePath("/");

  return result;
}

export async function setCover(galleryId: number, photoId: number) {
  requireUser();
  await execute("UPDATE galleries SET cover_photo_id = $1 WHERE id = $2", [
    photoId,
    galleryId,
  ]);
  revalidatePath("/portfolio");
  revalidatePath("/");
  revalidatePath(`/admin/galleries/${galleryId}`);
  const slug = (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [galleryId]))?.slug;
  if (slug) revalidatePath(`/portfolio/${slug}`);
}

/**
 * Live-save the focal point (object-position) of the gallery cover.
 * Stored as either "left|center|right top|center|bottom" OR a percentage
 * pair like "37% 62%" — the granular click-to-set mode. We accept any
 * "<x>% <y>%" with bounded numbers.
 */
export async function setGalleryCoverPosition(
  galleryId: number,
  position: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    const safe = sanitizePosition(position);
    await execute("UPDATE galleries SET cover_position = $1 WHERE id = $2", [safe, galleryId]);
    revalidatePath("/portfolio");
    revalidatePath("/");
    revalidatePath(`/admin/galleries/${galleryId}`);
    const slug = (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [galleryId]))?.slug;
    if (slug) revalidatePath(`/portfolio/${slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}


export async function deletePhoto(photoId: number) {
  requireUser();
  const row = await queryOne<{ filename: string; gallery_id: number }>(
    "SELECT filename, gallery_id FROM photos WHERE id = $1",
    [photoId]
  );
  if (!row) return;
  if (!row.filename.startsWith("hero")) {
    if (isBlobUrl(row.filename)) {
      if (USE_BLOB) {
        try { await del(row.filename); } catch {}
      }
    } else {
      const fp = path.join(UPLOADS_DIR, row.filename);
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch {}
      }
    }
  }
  // Null out the FK first so the photo row can be deleted cleanly.
  await execute("UPDATE galleries SET cover_photo_id = NULL WHERE cover_photo_id = $1", [photoId]);
  await execute("DELETE FROM photos WHERE id = $1", [photoId]);
  if (row.gallery_id) revalidatePath(`/admin/galleries/${row.gallery_id}`);
  revalidatePath("/portfolio");
}

export async function updatePhotoSpan(photoId: number, span: string) {
  requireUser();
  const valid = ["", "wide", "tall", "big"];
  if (!valid.includes(span)) return;
  await execute("UPDATE photos SET span = $1 WHERE id = $2", [span, photoId]);
  const row = await queryOne<{ gallery_id: number }>("SELECT gallery_id FROM photos WHERE id = $1", [photoId]);
  if (row?.gallery_id) revalidatePath(`/admin/galleries/${row.gallery_id}`);
  const slug = row?.gallery_id
    ? (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [row.gallery_id]))?.slug
    : undefined;
  if (slug) revalidatePath(`/portfolio/${slug}`);
}

export async function updatePhotoAlt(photoId: number, alt: string) {
  requireUser();
  await execute("UPDATE photos SET alt = $1 WHERE id = $2", [alt.slice(0, 200), photoId]);
  const row = await queryOne<{ gallery_id: number }>("SELECT gallery_id FROM photos WHERE id = $1", [photoId]);
  if (row?.gallery_id) revalidatePath(`/admin/galleries/${row.gallery_id}`);
}

/**
 * Bulk-reorder photos by passing the IDs in their new desired order.
 * Used by the drag-and-drop grid so a single drop call rewrites every
 * sort_order in one transaction instead of N "swap" round-trips.
 *
 * Safe-by-construction: we re-fetch the gallery's current photo IDs and
 * intersect with the input, so callers can't promote a foreign photo or
 * accidentally drop rows.
 */
export async function reorderGalleryPhotos(
  galleryId: number,
  orderedPhotoIds: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    if (!Array.isArray(orderedPhotoIds) || orderedPhotoIds.length === 0) {
      return { ok: false, error: "Liste vide" };
    }
    const existing = await query<{ id: number }>(
      "SELECT id FROM photos WHERE gallery_id = $1",
      [galleryId]
    );
    const allowed = new Set(existing.map((r) => r.id));
    const clean = orderedPhotoIds.filter((id) => Number.isInteger(id) && allowed.has(id));
    if (clean.length === 0) return { ok: false, error: "Aucune photo valide" };

    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < clean.length; i++) {
        await client.query(
          "UPDATE photos SET sort_order = $1 WHERE id = $2 AND gallery_id = $3",
          [i, clean[i], galleryId]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    revalidatePath(`/admin/galleries/${galleryId}`);
    const slug = (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [galleryId]))?.slug;
    if (slug) revalidatePath(`/portfolio/${slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function movePhoto(photoId: number, direction: "up" | "down") {
  requireUser();
  const me = await queryOne<{ id: number; gallery_id: number; sort_order: number }>(
    "SELECT id, gallery_id, sort_order FROM photos WHERE id = $1",
    [photoId]
  );
  if (!me) return;
  const sibling = await queryOne<{ id: number; sort_order: number }>(
    direction === "up"
      ? "SELECT id, sort_order FROM photos WHERE gallery_id = $1 AND sort_order < $2 ORDER BY sort_order DESC LIMIT 1"
      : "SELECT id, sort_order FROM photos WHERE gallery_id = $1 AND sort_order > $2 ORDER BY sort_order ASC LIMIT 1",
    [me.gallery_id, me.sort_order]
  );
  if (!sibling) return;
  // Postgres transactional swap. Use a client checkout because the two
  // UPDATEs must run on the same connection inside a BEGIN/COMMIT.
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE photos SET sort_order = $1 WHERE id = $2", [sibling.sort_order, me.id]);
    await client.query("UPDATE photos SET sort_order = $1 WHERE id = $2", [me.sort_order, sibling.id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  revalidatePath(`/admin/galleries/${me.gallery_id}`);
  const slug = (await queryOne<{ slug: string }>("SELECT slug FROM galleries WHERE id = $1", [me.gallery_id]))?.slug;
  if (slug) revalidatePath(`/portfolio/${slug}`);
}
