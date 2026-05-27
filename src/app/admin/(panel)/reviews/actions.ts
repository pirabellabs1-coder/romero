"use server";
import { revalidatePath } from "next/cache";
import { getDbAsync } from "@/lib/db";
import { syncDb } from "@/lib/db-persist";
import { requireUser } from "@/lib/auth";

// CRITICAL: all writes go through getDbAsync(). Using the sync getDb() on a
// cold-start lambda would open the bundled seed DB (not the latest snapshot
// restored from Blob), then syncDb() would push seed+1edit back to Blob —
// silently wiping every prior admin edit. See lib/db.ts for the cold-start
// restore logic.

export async function createReview(formData: FormData) {
  requireUser();
  const name = String(formData.get("name") || "").trim();
  const text_fr = String(formData.get("text_fr") || "").trim();
  if (!name || !text_fr) return;
  const db = await getDbAsync();
  db
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
  await syncDb();
  revalidatePath("/avis");
}

export async function updateReview(id: number, formData: FormData) {
  requireUser();
  const db = await getDbAsync();
  db
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
  await syncDb();
  revalidatePath("/avis");
}

export async function deleteReview(id: number) {
  requireUser();
  const db = await getDbAsync();
  db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
  await syncDb();
  revalidatePath("/avis");
}
