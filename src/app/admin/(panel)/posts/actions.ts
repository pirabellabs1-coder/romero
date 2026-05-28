"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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

  // Cover is now always set via the cover_pick hidden input — the CoverPicker
  // does any client → Blob upload before submit, so by the time we get here
  // we just have a URL or relative path string. No file bytes pass through
  // this Server Action (which would have been capped at 4.5 MB on Vercel).
  const coverPick = String(formData.get("cover_pick") || "").trim();
  const coverFilename: string | null = coverPick || null;

  // Validate cover_position against an allowlist — defence against an admin
  // pasting arbitrary CSS into the hidden input.
  const ALLOWED_POS = new Set([
    "left top", "center top", "right top",
    "left center", "center center", "right center",
    "left bottom", "center bottom", "right bottom",
  ]);
  const posRaw = String(formData.get("cover_position") || "center center").trim();
  const coverPosition = ALLOWED_POS.has(posRaw) ? posRaw : "center center";

  // Two query shapes — with and without cover_filename — to keep the SQL
  // tidy. cover_position is updated in both.
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
    coverPosition,
  ];
  if (coverFilename) {
    await execute(
      `UPDATE posts SET title_fr = $1, title_en = $2, category = $3, excerpt_fr = $4,
         excerpt_en = $5, body_fr = $6, body_en = $7, published_at = $8, read_minutes = $9,
         published = $10, sort_order = $11, cover_position = $12, cover_filename = $13
       WHERE id = $14`,
      [...baseParams, coverFilename, id]
    );
  } else {
    await execute(
      `UPDATE posts SET title_fr = $1, title_en = $2, category = $3, excerpt_fr = $4,
         excerpt_en = $5, body_fr = $6, body_en = $7, published_at = $8, read_minutes = $9,
         published = $10, sort_order = $11, cover_position = $12
       WHERE id = $13`,
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
