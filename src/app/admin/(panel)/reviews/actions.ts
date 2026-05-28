"use server";
import { revalidatePath } from "next/cache";
import { execute } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createReview(formData: FormData) {
  requireUser();
  const name = String(formData.get("name") || "").trim();
  const text_fr = String(formData.get("text_fr") || "").trim();
  if (!name || !text_fr) return;
  await execute(
    `INSERT INTO reviews (name, date_label, rating, text_fr, text_en, sort_order, published)
     VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(sort_order)+1 FROM reviews), 0), 1)`,
    [
      name,
      String(formData.get("date_label") || ""),
      Number(formData.get("rating") || 5),
      text_fr,
      String(formData.get("text_en") || ""),
    ]
  );
  revalidatePath("/avis");
}

export async function updateReview(id: number, formData: FormData) {
  requireUser();
  await execute(
    `UPDATE reviews SET name = $1, date_label = $2, rating = $3, text_fr = $4, text_en = $5,
       sort_order = $6, published = $7 WHERE id = $8`,
    [
      String(formData.get("name") || ""),
      String(formData.get("date_label") || ""),
      Number(formData.get("rating") || 5),
      String(formData.get("text_fr") || ""),
      String(formData.get("text_en") || ""),
      Number(formData.get("sort_order") || 0),
      formData.get("published") ? 1 : 0,
      id,
    ]
  );
  revalidatePath("/avis");
}

export async function deleteReview(id: number) {
  requireUser();
  await execute("DELETE FROM reviews WHERE id = $1", [id]);
  revalidatePath("/avis");
}
