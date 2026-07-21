"use server";
import { requireUser } from "@/lib/auth";
import { execute, queryOne } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Ajout rapide d'un mariage à venir dans admin_contacts.
 * Upsert par email : si le contact existe déjà, on complète les
 * champs vides.
 */
export async function addWeddingAction(
  fd: FormData
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    await requireUser();

    const get = (k: string, max = 200): string => {
      const v = fd.get(k);
      return typeof v === "string" ? v.trim().slice(0, max) : "";
    };

    const name = get("name", 120);
    const wedding_date = get("wedding_date", 20);
    const wedding_location = get("wedding_location", 200);
    const email = get("email", 200);
    const phone = get("phone", 40);
    const notes = get("notes", 2000);

    if (!name) return { ok: false, error: "Nom du couple obligatoire." };
    if (!wedding_date || !/^\d{4}-\d{2}-\d{2}$/.test(wedding_date))
      return { ok: false, error: "Date invalide (YYYY-MM-DD attendu)." };

    // Upsert par email (si fourni) sinon par nom
    let existing: { id: number } | null = null;
    if (email) {
      existing = await queryOne<{ id: number }>(
        `SELECT id FROM admin_contacts WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
    }
    if (!existing) {
      existing = await queryOne<{ id: number }>(
        `SELECT id FROM admin_contacts WHERE LOWER(name) = LOWER($1)`,
        [name]
      );
    }

    if (existing) {
      // Update prudent : ne remplace jamais un champ existant si non vide
      await execute(
        `UPDATE admin_contacts SET
           name = COALESCE(NULLIF(name, ''), $1),
           email = COALESCE(NULLIF(email, ''), $2),
           phone = COALESCE(NULLIF(phone, ''), $3),
           wedding_date = COALESCE(wedding_date, $4::date),
           wedding_location = COALESCE(NULLIF(wedding_location, ''), $5),
           notes = COALESCE(NULLIF(notes, ''), $6),
           updated_at = NOW()
         WHERE id = $7`,
        [name, email, phone, wedding_date, wedding_location, notes, existing.id]
      );
      revalidatePath("/admin/calendar");
      return { ok: true, id: existing.id };
    }

    const row = await queryOne<{ id: number }>(
      `INSERT INTO admin_contacts (name, email, phone, wedding_date, wedding_location, notes)
       VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4::date, NULLIF($5, ''), NULLIF($6, ''))
       RETURNING id`,
      [name, email, phone, wedding_date, wedding_location, notes]
    );
    if (!row) return { ok: false, error: "Insert retourna vide." };
    revalidatePath("/admin/calendar");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}
