"use server";
import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { createApprovalRequest } from "@/lib/approval-flow";
import { revalidatePath } from "next/cache";

/**
 * Déclenche l'approval flow à la demande pour un thread contact du inbox.
 * Utile si Mickael veut re-générer un draft ou si le draft auto n'a pas
 * été envoyé au moment du form submit.
 */
export async function generateReplyForContactAction(
  contactId: number
): Promise<{ ok: true; approvalId: number } | { ok: false; error: string }> {
  try {
    await requireUser();
    const row = await queryOne<{
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      place: string;
      wedding_date: string;
      message: string;
      lang: string;
    }>(
      `SELECT first_name, last_name, email, phone, place, wedding_date, message, lang
       FROM messages WHERE id = $1`,
      [contactId]
    );
    if (!row) return { ok: false, error: "Message introuvable" };

    // #5 Idempotence : ne pas generer un 2e brouillon si une reponse est
    // deja en cours ou deja envoyee pour ce message. Une demande 'rejected'
    // ou 'sent_failed' n'empeche pas une nouvelle tentative.
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM pending_approvals
       WHERE source = 'contact_form' AND source_id = $1
         AND status IN ('pending','edited_pending','sent')
       LIMIT 1`,
      [contactId]
    );
    if (existing)
      return {
        ok: false,
        error: "Une reponse est deja en cours ou deja envoyee pour ce message.",
      };

    const meta = [
      row.phone && `Téléphone : ${row.phone}`,
      row.place && `Lieu : ${row.place}`,
      row.wedding_date && `Date mariage : ${row.wedding_date}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await createApprovalRequest({
      source: "contact_form",
      sourceId: contactId,
      contactName: `${row.first_name} ${row.last_name}`.trim(),
      contactEmail: row.email,
      contactMessage: row.message,
      contactMeta: meta,
      language: row.lang === "en" ? "en" : "fr",
    });
    if (!res.ok) return { ok: false, error: res.error ?? "?" };
    revalidatePath("/admin/inbox");
    return { ok: true, approvalId: res.approvalId! };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}
