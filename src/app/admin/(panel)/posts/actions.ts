"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sanitizePosition } from "@/lib/cover-position";

/**
 * Live-save the post's cover. Called by CoverPicker as soon as:
 *   • a new file finishes uploading client → Blob, or
 *   • the user picks a photo from a gallery, or
 *   • the focal point (object-position) changes.
 *
 * Decouples cover management from the rest of the post-edit form so the
 * photographer doesn't have to click ENREGISTRER to "commit" a media
 * choice she's already made. Returns simple ok/error so the client can
 * show inline feedback.
 */
export async function updatePostCover(
  postId: number,
  coverFilename: string | null,
  coverPosition: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    requireUser();
    const pos = sanitizePosition(coverPosition);
    // null clears the cover (back to fallback); empty string would do nothing
    // useful so we treat it the same as null.
    const value = coverFilename && coverFilename.trim() ? coverFilename.trim() : null;
    await execute(
      "UPDATE posts SET cover_filename = $1, cover_position = $2 WHERE id = $3",
      [value, pos, postId]
    );
    // Invalidate blog and the specific post detail.
    revalidatePath("/blog");
    const slug = (await queryOne<{ slug: string }>("SELECT slug FROM posts WHERE id = $1", [postId]))?.slug;
    if (slug) revalidatePath(`/blog/${slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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

  // Cover is managed live by the CoverPicker via updatePostCover() — it
  // saves itself as soon as the photographer picks/uploads/repositions,
  // without waiting for the big ENREGISTRER button. So this action only
  // touches the text/metadata fields.
  await execute(
    `UPDATE posts SET title_fr = $1, title_en = $2, category = $3, excerpt_fr = $4,
       excerpt_en = $5, body_fr = $6, body_en = $7, published_at = $8, read_minutes = $9,
       published = $10, sort_order = $11
     WHERE id = $12`,
    [
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
    ]
  );

  revalidatePath("/blog");
  redirect(`/admin/posts/${id}?ok=saved`);
}

export async function deletePost(id: number) {
  requireUser();
  await execute("DELETE FROM posts WHERE id = $1", [id]);
  revalidatePath("/blog");
  redirect("/admin/posts?ok=deleted");
}
