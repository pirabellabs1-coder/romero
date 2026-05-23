"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createReview(formData: FormData) {
  requireUser();
  const name = String(formData.get("name") || "").trim();
  const text_fr = String(formData.get("text_fr") || "").trim();
  if (!name || !text_fr) return;
  getDb()
    .prepare(
      `INSERT INTO reviews (name, date_label, rating, text_fr, text_en, sort_order, published)
       VALUES (?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order)+1 FROM reviews), 0), 1)`
    )
    .run(
      name,
      String(formData.get("date_label") || ""),
      Number(formData.get("rating") || 5),
      text_fr,
      String(formData.get("text_en") || "")
    );
  revalidatePath("/avis");
}

export async function updateReview(id: number, formData: FormData) {
  requireUser();
  getDb()
    .prepare(
      `UPDATE reviews SET name = ?, date_label = ?, rating = ?, text_fr = ?, text_en = ?, sort_order = ?, published = ? WHERE id = ?`
    )
    .run(
      String(formData.get("name") || ""),
      String(formData.get("date_label") || ""),
      Number(formData.get("rating") || 5),
      String(formData.get("text_fr") || ""),
      String(formData.get("text_en") || ""),
      Number(formData.get("sort_order") || 0),
      formData.get("published") ? 1 : 0,
      id
    );
  revalidatePath("/avis");
}

export async function deleteReview(id: number) {
  requireUser();
  getDb().prepare("DELETE FROM reviews WHERE id = ?").run(id);
  revalidatePath("/avis");
}
