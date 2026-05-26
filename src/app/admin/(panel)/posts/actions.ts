"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { syncDb } from "@/lib/db-persist";
import { requireUser } from "@/lib/auth";

const MAX_DIM = 2000;
const WEBP_QUALITY = 80;

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function createPost(formData: FormData) {
  requireUser();
  const title = String(formData.get("title_fr") || "").trim();
  if (!title) return;
  const db = getDb();
  let slug = slugify(title) || "article";
  let i = 1;
  const baseSlug = slug;
  while ((db.prepare("SELECT 1 FROM posts WHERE slug = ?").get(slug) as unknown) !== undefined) {
    slug = `${baseSlug}-${i++}`;
  }
  const r = db
    .prepare(
      `INSERT INTO posts (slug, title_fr, title_en, category, excerpt_fr, excerpt_en, body_fr, body_en, published_at, read_minutes, published, sort_order)
       VALUES (?, ?, '', ?, '', '', '', '', ?, ?, 1, COALESCE((SELECT MAX(sort_order)+1 FROM posts), 0))`
    )
    .run(
      slug,
      title,
      String(formData.get("category") || "MARIAGES"),
      String(formData.get("published_at") || new Date().toISOString().slice(0, 10)),
      Number(formData.get("read_minutes") || 5)
    );
  revalidatePath("/blog");
  await syncDb();
  redirect(`/admin/posts/${r.lastInsertRowid}`);
}

export async function updatePost(id: number, formData: FormData) {
  requireUser();
  const db = getDb();
  let coverFilename: string | null = null;
  const coverFile = formData.get("cover") as File | null;
  if (coverFile && coverFile.size > 0) {
    const ext = path.extname(coverFile.name).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const fn = `posts/post${id}-${ts}.webp`;
      const fullPath = path.join(UPLOADS_DIR, fn);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const buf = Buffer.from(await coverFile.arrayBuffer());
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
        await pipeline.webp({ quality: WEBP_QUALITY, effort: 5 }).toFile(fullPath);
      } catch {
        fs.writeFileSync(fullPath, buf);
      }
      coverFilename = fn;
    }
  }
  db.prepare(
    `UPDATE posts SET title_fr = ?, title_en = ?, category = ?, excerpt_fr = ?, excerpt_en = ?,
                       body_fr = ?, body_en = ?, published_at = ?, read_minutes = ?,
                       published = ?, sort_order = ?
                       ${coverFilename ? ", cover_filename = ?" : ""}
     WHERE id = ?`
  ).run(
    ...(coverFilename
      ? [
          String(formData.get("title_fr") || ""),
          String(formData.get("title_en") || ""),
          String(formData.get("category") || ""),
          String(formData.get("excerpt_fr") || ""),
          String(formData.get("excerpt_en") || ""),
          String(formData.get("body_fr") || ""),
          String(formData.get("body_en") || ""),
          String(formData.get("published_at") || ""),
          Number(formData.get("read_minutes") || 5),
          formData.get("published") ? 1 : 0,
          Number(formData.get("sort_order") || 0),
          coverFilename,
          id,
        ]
      : [
          String(formData.get("title_fr") || ""),
          String(formData.get("title_en") || ""),
          String(formData.get("category") || ""),
          String(formData.get("excerpt_fr") || ""),
          String(formData.get("excerpt_en") || ""),
          String(formData.get("body_fr") || ""),
          String(formData.get("body_en") || ""),
          String(formData.get("published_at") || ""),
          Number(formData.get("read_minutes") || 5),
          formData.get("published") ? 1 : 0,
          Number(formData.get("sort_order") || 0),
          id,
        ])
  );
  revalidatePath("/blog");
  await syncDb();
  redirect(`/admin/posts/${id}?ok=saved`);
}

export async function deletePost(id: number) {
  requireUser();
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
  revalidatePath("/blog");
  await syncDb();
  redirect("/admin/posts?ok=deleted");
}
