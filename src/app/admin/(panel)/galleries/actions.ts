"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { put, del } from "@vercel/blob";
import { getDb, getDbAsync } from "@/lib/db";
import { syncDb } from "@/lib/db-persist";
import { requireUser } from "@/lib/auth";

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
// Helper to test which one.
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
  const db = await getDbAsync();
  let slug = baseSlug;
  let i = 1;
  while ((db.prepare("SELECT 1 FROM galleries WHERE slug = ?").get(slug) as unknown) !== undefined) {
    slug = `${baseSlug}-${i++}`;
  }
  const r = db
    .prepare(
      `INSERT INTO galleries (slug, names, place, date_label, region, kind, intro_fr, intro_en, featured, published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, '', '', 0, 1, COALESCE((SELECT MAX(sort_order)+1 FROM galleries), 0))`
    )
    .run(
      slug,
      names,
      place,
      String(formData.get("date_label") || ""),
      String(formData.get("region") || "FRANCE"),
      String(formData.get("kind") || "MARIAGE")
    );
  await syncDb();
  revalidatePath("/portfolio");
  revalidatePath("/");
  redirect(`/admin/galleries/${r.lastInsertRowid}`);
}

export async function updateGallery(id: number, formData: FormData) {
  requireUser();
  const db = await getDbAsync();
  const featured = formData.get("featured") ? 1 : 0;
  const published = formData.get("published") ? 1 : 0;
  db.prepare(
    `UPDATE galleries SET names = ?, place = ?, date_label = ?, region = ?, kind = ?,
       intro_fr = ?, intro_en = ?, featured = ?, published = ?, sort_order = ?
     WHERE id = ?`
  ).run(
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
    id
  );
  await syncDb();
  revalidatePath("/portfolio");
  const slug = (db.prepare("SELECT slug FROM galleries WHERE id = ?").get(id) as { slug: string } | undefined)?.slug;
  if (slug) revalidatePath(`/portfolio/${slug}`);
  revalidatePath("/");
  redirect(`/admin/galleries/${id}?ok=saved`);
}

export async function deleteGallery(id: number) {
  requireUser();
  const db = await getDbAsync();
  const photos = db.prepare("SELECT filename FROM photos WHERE gallery_id = ?").all(id) as { filename: string }[];
  for (const p of photos) {
    if (p.filename.startsWith("hero")) continue; // never delete the seed hero
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
  db.prepare("DELETE FROM photos WHERE gallery_id = ?").run(id);
  db.prepare("DELETE FROM galleries WHERE id = ?").run(id);
  await syncDb();
  revalidatePath("/portfolio");
  revalidatePath("/");
  redirect("/admin/galleries?ok=deleted");
}

export async function uploadPhoto(galleryId: number, formData: FormData) {
  requireUser();
  const files = formData.getAll("files") as File[];
  if (files.length === 0) return;
  const db = await getDbAsync();
  const ins = db.prepare(
    `INSERT INTO photos (gallery_id, filename, alt, span, sort_order)
     VALUES (?, ?, '', '', COALESCE((SELECT MAX(sort_order)+1 FROM photos WHERE gallery_id = ?), 0))`
  );
  const insertedIds: number[] = [];

  // Local dev: create the public/uploads subfolder. Prod (Blob) skips this.
  const galleryFolder = `galleries/g${galleryId}`;
  if (!USE_BLOB) {
    ensureDirs();
    const galleryAbs = path.join(UPLOADS_DIR, galleryFolder);
    if (!fs.existsSync(galleryAbs)) fs.mkdirSync(galleryAbs, { recursive: true });
  }

  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE_BYTES) continue; // reject oversized
    const ext = path.extname(file.name).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) continue;

    const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const buf = Buffer.from(await file.arrayBuffer());

    // Run the sharp pipeline once, producing an optimized WebP buffer that
    // we then either write to disk (dev) or upload to Vercel Blob (prod).
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
      // Sharp failure → store the raw upload, preserving its original ext.
      webpBuf = buf;
    }

    let storedFilename: string;
    if (USE_BLOB) {
      // Prod: upload to Vercel Blob, store the full URL in DB.
      const blob = await put(`${galleryFolder}/p${ts}.webp`, webpBuf, {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: false,
      });
      storedFilename = blob.url;
    } else {
      // Dev: write to public/uploads, store relative path in DB.
      const filename = `${galleryFolder}/p${ts}.webp`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), webpBuf);
      storedFilename = filename;
    }

    const r = ins.run(galleryId, storedFilename, galleryId);
    insertedIds.push(Number(r.lastInsertRowid));
  }

  // Auto-set first uploaded as cover if none yet
  const current = db.prepare("SELECT cover_photo_id FROM galleries WHERE id = ?").get(galleryId) as
    | { cover_photo_id: number | null }
    | undefined;
  if (current && current.cover_photo_id == null && insertedIds.length > 0) {
    db.prepare("UPDATE galleries SET cover_photo_id = ? WHERE id = ?").run(insertedIds[0], galleryId);
  }

  const slug = (db.prepare("SELECT slug FROM galleries WHERE id = ?").get(galleryId) as { slug: string } | undefined)?.slug;
  await syncDb();
  if (slug) revalidatePath(`/portfolio/${slug}`);
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath("/portfolio");
  revalidatePath("/");
}

export async function setCover(galleryId: number, photoId: number) {
  requireUser();
  const db = await getDbAsync();
  db.prepare("UPDATE galleries SET cover_photo_id = ? WHERE id = ?").run(photoId, galleryId);
  await syncDb();
  revalidatePath("/portfolio");
  revalidatePath("/");
  revalidatePath(`/admin/galleries/${galleryId}`);
}

export async function deletePhoto(photoId: number) {
  requireUser();
  const db = await getDbAsync();
  const row = db.prepare("SELECT filename, gallery_id FROM photos WHERE id = ?").get(photoId) as
    | { filename: string; gallery_id: number }
    | undefined;
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
  db.prepare("UPDATE galleries SET cover_photo_id = NULL WHERE cover_photo_id = ?").run(photoId);
  db.prepare("DELETE FROM photos WHERE id = ?").run(photoId);
  await syncDb();
  if (row.gallery_id) revalidatePath(`/admin/galleries/${row.gallery_id}`);
  revalidatePath("/portfolio");
}

export async function updatePhotoSpan(photoId: number, span: string) {
  requireUser();
  const valid = ["", "wide", "tall", "big"];
  if (!valid.includes(span)) return;
  const db = await getDbAsync();
  db.prepare("UPDATE photos SET span = ? WHERE id = ?").run(span, photoId);
  await syncDb();
  const row = db.prepare("SELECT gallery_id FROM photos WHERE id = ?").get(photoId) as { gallery_id: number } | undefined;
  if (row?.gallery_id) revalidatePath(`/admin/galleries/${row.gallery_id}`);
  const slug = row?.gallery_id
    ? (db.prepare("SELECT slug FROM galleries WHERE id = ?").get(row.gallery_id) as { slug: string } | undefined)?.slug
    : undefined;
  if (slug) revalidatePath(`/portfolio/${slug}`);
}

export async function updatePhotoAlt(photoId: number, alt: string) {
  requireUser();
  const db = await getDbAsync();
  db.prepare("UPDATE photos SET alt = ? WHERE id = ?").run(alt.slice(0, 200), photoId);
  await syncDb();
  const row = db.prepare("SELECT gallery_id FROM photos WHERE id = ?").get(photoId) as { gallery_id: number } | undefined;
  if (row?.gallery_id) revalidatePath(`/admin/galleries/${row.gallery_id}`);
}

export async function movePhoto(photoId: number, direction: "up" | "down") {
  requireUser();
  const db = await getDbAsync();
  const me = db
    .prepare("SELECT id, gallery_id, sort_order FROM photos WHERE id = ?")
    .get(photoId) as { id: number; gallery_id: number; sort_order: number } | undefined;
  if (!me) return;
  const sibling = db
    .prepare(
      direction === "up"
        ? "SELECT id, sort_order FROM photos WHERE gallery_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1"
        : "SELECT id, sort_order FROM photos WHERE gallery_id = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1"
    )
    .get(me.gallery_id, me.sort_order) as { id: number; sort_order: number } | undefined;
  if (!sibling) return;
  const tx = db.transaction(() => {
    db.prepare("UPDATE photos SET sort_order = ? WHERE id = ?").run(sibling.sort_order, me.id);
    db.prepare("UPDATE photos SET sort_order = ? WHERE id = ?").run(me.sort_order, sibling.id);
  });
  tx();
  await syncDb();
  revalidatePath(`/admin/galleries/${me.gallery_id}`);
  const slug = (db.prepare("SELECT slug FROM galleries WHERE id = ?").get(me.gallery_id) as { slug: string } | undefined)?.slug;
  if (slug) revalidatePath(`/portfolio/${slug}`);
}
