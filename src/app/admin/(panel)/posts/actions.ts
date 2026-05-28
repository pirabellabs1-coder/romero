"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { execute, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const MAX_DIM = 2000;
const WEBP_QUALITY = 80;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

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
  let slug = slugify(title) || "article";
  let i = 1;
  const baseSlug = slug;
  while ((await queryOne<{ x: number }>("SELECT 1 AS x FROM posts WHERE slug = $1", [slug])) !== null) {
    slug = `${baseSlug}-${i++}`;
  }
  const r = await queryOne<{ id: number }>(
    `INSERT INTO posts (slug, title_fr, title_en, category, excerpt_fr, excerpt_en, body_fr, body_en,
                        published_at, read_minutes, published, sort_order)
     VALUES ($1, $2, '', $3, '', '', '', '', $4, $5, 1,
             COALESCE((SELECT MAX(sort_order)+1 FROM posts), 0))
     RETURNING id`,
    [
      slug,
      title,
      String(formData.get("category") || "MARIAGES"),
      String(formData.get("published_at") || new Date().toISOString().slice(0, 10)),
      Number(formData.get("read_minutes") || 5),
    ]
  );
  revalidatePath("/blog");
  if (r?.id) redirect(`/admin/posts/${r.id}`);
}

export async function updatePost(id: number, formData: FormData) {
  requireUser();
  let coverFilename: string | null = null;
  const coverFile = formData.get("cover") as File | null;
  if (coverFile && coverFile.size > 0 && coverFile.size <= MAX_FILE_SIZE_BYTES) {
    const ext = path.extname(coverFile.name).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      const fnKey = `posts/post${id}-${ts}.webp`;
      const buf = Buffer.from(await coverFile.arrayBuffer());

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
        webpBuf = buf;
      }

      if (USE_BLOB) {
        const blob = await put(fnKey, webpBuf, {
          access: "public",
          contentType: "image/webp",
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        coverFilename = blob.url;
      } else {
        const fullPath = path.join(UPLOADS_DIR, fnKey);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, webpBuf);
        coverFilename = fnKey;
      }
    }
  }

  // Two query shapes — with and without cover_filename — to keep the SQL
  // tidy. The 11-param version is the cover-less default.
  const baseParams = [
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
  ];
  if (coverFilename) {
    await execute(
      `UPDATE posts SET title_fr = $1, title_en = $2, category = $3, excerpt_fr = $4,
         excerpt_en = $5, body_fr = $6, body_en = $7, published_at = $8, read_minutes = $9,
         published = $10, sort_order = $11, cover_filename = $12 WHERE id = $13`,
      [...baseParams, coverFilename, id]
    );
  } else {
    await execute(
      `UPDATE posts SET title_fr = $1, title_en = $2, category = $3, excerpt_fr = $4,
         excerpt_en = $5, body_fr = $6, body_en = $7, published_at = $8, read_minutes = $9,
         published = $10, sort_order = $11 WHERE id = $12`,
      [...baseParams, id]
    );
  }

  revalidatePath("/blog");
  redirect(`/admin/posts/${id}?ok=saved`);
}

export async function deletePost(id: number) {
  requireUser();
  await execute("DELETE FROM posts WHERE id = $1", [id]);
  revalidatePath("/blog");
  redirect("/admin/posts?ok=deleted");
}
