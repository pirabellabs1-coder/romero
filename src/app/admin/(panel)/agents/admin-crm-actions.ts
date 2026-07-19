"use server";
/**
 * Server actions dédiées au CRM clients et au dashboard financier
 * de l'agent admin. Séparé de `admin-actions.ts` pour rester lisible
 * (l'autre fichier fait déjà 534 lignes).
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, queryOne, execute } from "@/lib/db";
import { logEvent } from "@/lib/agents";
import { notifyMickael } from "@/lib/whatsapp-notify";

// ─── Types ────────────────────────────────────────────────────────
export type AdminContact = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
  notes: string | null;
  document_count: number;
  last_document_at: string | null;
  total_billed_cents: number;
  created_at: string;
  updated_at: string;
};

export type FinancialSnapshot = {
  ca_month_cents: number;
  ca_year_cents: number;
  invoices_pending_cents: number;
  invoices_overdue_cents: number;
  contracts_pending_signature: number;
  quotes_pending: number;
  quotes_expired_last_30d: number;
  invoices_paid_last_30d: number;
};

function revalidate() {
  revalidatePath("/admin/agents/admin");
}

// ─── CRM — Contacts CRUD ──────────────────────────────────────────
export async function listContactsAction(
  q?: string,
  limit = 100
): Promise<AdminContact[]> {
  const rows = q
    ? await query<AdminContact>(
        `SELECT * FROM admin_contacts
         WHERE LOWER(name) LIKE LOWER($1) OR LOWER(COALESCE(email,'')) LIKE LOWER($1)
         ORDER BY updated_at DESC
         LIMIT $2`,
        [`%${q}%`, limit]
      )
    : await query<AdminContact>(
        `SELECT * FROM admin_contacts
         ORDER BY last_document_at DESC NULLS LAST, updated_at DESC
         LIMIT $1`,
        [limit]
      );
  return rows;
}

export async function getContactAction(
  id: number
): Promise<AdminContact | null> {
  return queryOne<AdminContact>(
    `SELECT * FROM admin_contacts WHERE id = $1`,
    [id]
  );
}

export async function createContactAction(input: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  wedding_date?: string;
  wedding_location?: string;
  notes?: string;
}): Promise<
  | { ok: true; id: number }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    if (!input.name.trim())
      return { ok: false, error: "Nom obligatoire" };

    // Dédup par email si fourni
    if (input.email) {
      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM admin_contacts WHERE LOWER(email) = LOWER($1)`,
        [input.email]
      );
      if (existing) return { ok: false, error: "Un contact avec cet e-mail existe déjà" };
    }

    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO admin_contacts (name, email, phone, address, wedding_date, wedding_location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.name.trim(),
        input.email?.trim() || null,
        input.phone?.trim() || null,
        input.address?.trim() || null,
        input.wedding_date || null,
        input.wedding_location?.trim() || null,
        input.notes?.trim() || null,
      ]
    );
    if (!inserted?.id) return { ok: false, error: "Insert échoué" };
    await logEvent("admin", "contact_created", { id: inserted.id });
    revalidate();
    return { ok: true, id: inserted.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateContactAction(
  id: number,
  patch: Partial<{
    name: string;
    email: string;
    phone: string;
    address: string;
    wedding_date: string;
    wedding_location: string;
    notes: string;
  }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${k} = $${i++}`);
      params.push(v === "" ? null : v);
    }
    if (sets.length === 0)
      return { ok: false, error: "Rien à mettre à jour" };
    sets.push(`updated_at = NOW()`);
    params.push(id);
    await execute(
      `UPDATE admin_contacts SET ${sets.join(", ")} WHERE id = $${i}`,
      params
    );
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteContactAction(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    await execute(`DELETE FROM admin_contacts WHERE id = $1`, [id]);
    await logEvent("admin", "contact_deleted", { id });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Sync : peuple admin_contacts depuis admin_documents ─────────
// Utilité : quand la table CRM est vide (première utilisation),
// alimenter automatiquement depuis les documents déjà créés.
export async function syncContactsFromDocumentsAction(): Promise<
  | { ok: true; created: number; updated: number; scanned: number }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    // Aggrégation SQL — un contact par (client_name, client_email) unique.
    const rows = await query<{
      client_name: string;
      client_email: string | null;
      client_phone: string | null;
      client_address: string | null;
      wedding_date: string | null;
      wedding_location: string | null;
      document_count: number;
      last_document_at: string;
      total_billed_cents: number;
    }>(
      `SELECT
         client_name,
         MAX(client_email) AS client_email,
         MAX(client_phone) AS client_phone,
         MAX(client_address) AS client_address,
         MAX(wedding_date::text) AS wedding_date,
         MAX(wedding_location) AS wedding_location,
         COUNT(*)::int AS document_count,
         MAX(created_at) AS last_document_at,
         COALESCE(SUM(CASE WHEN doc_type = 'invoice' AND status = 'paid' THEN total_cents ELSE 0 END), 0) AS total_billed_cents
       FROM admin_documents
       WHERE client_name IS NOT NULL AND LENGTH(TRIM(client_name)) > 0
       GROUP BY client_name`
    );

    let created = 0;
    let updated = 0;
    for (const r of rows) {
      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM admin_contacts WHERE LOWER(name) = LOWER($1)`,
        [r.client_name]
      );
      if (existing) {
        await execute(
          `UPDATE admin_contacts
           SET
             email = COALESCE(email, $1),
             phone = COALESCE(phone, $2),
             address = COALESCE(address, $3),
             wedding_date = COALESCE(wedding_date, $4::date),
             wedding_location = COALESCE(wedding_location, $5),
             document_count = $6,
             last_document_at = $7,
             total_billed_cents = $8,
             updated_at = NOW()
           WHERE id = $9`,
          [
            r.client_email,
            r.client_phone,
            r.client_address,
            r.wedding_date,
            r.wedding_location,
            r.document_count,
            r.last_document_at,
            r.total_billed_cents,
            existing.id,
          ]
        );
        updated++;
      } else {
        await execute(
          `INSERT INTO admin_contacts
             (name, email, phone, address, wedding_date, wedding_location,
              document_count, last_document_at, total_billed_cents)
           VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)`,
          [
            r.client_name,
            r.client_email,
            r.client_phone,
            r.client_address,
            r.wedding_date,
            r.wedding_location,
            r.document_count,
            r.last_document_at,
            r.total_billed_cents,
          ]
        );
        created++;
      }
    }
    await logEvent("admin", "contacts_synced", {
      created,
      updated,
      scanned: rows.length,
    });
    revalidate();
    return { ok: true, created, updated, scanned: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Marquer une facture comme payée ─────────────────────────────
export async function markInvoicePaidAction(input: {
  docId: number;
  paidAt?: string; // ISO date, défaut = maintenant
  notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const at = input.paidAt ? new Date(input.paidAt).toISOString() : new Date().toISOString();
    await execute(
      `UPDATE admin_documents
       SET status = 'paid',
           paid_at = $1,
           notes = COALESCE(notes,'') || CASE WHEN $2 IS NULL THEN '' ELSE E'\n' || $2 END,
           updated_at = NOW()
       WHERE id = $3 AND doc_type = 'invoice'`,
      [at, input.notes ?? null, input.docId]
    );
    await logEvent("admin", "invoice_marked_paid", {
      doc_id: input.docId,
      paid_at: at,
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Dashboard financier — snapshot ──────────────────────────────
export async function getFinancialSnapshot(): Promise<FinancialSnapshot> {
  const row = await queryOne<{
    ca_month_cents: string | null;
    ca_year_cents: string | null;
    invoices_pending_cents: string | null;
    invoices_overdue_cents: string | null;
    contracts_pending_signature: number;
    quotes_pending: number;
    quotes_expired_last_30d: number;
    invoices_paid_last_30d: number;
  }>(
    `SELECT
       COALESCE(SUM(CASE
         WHEN doc_type = 'invoice' AND status = 'paid'
              AND paid_at >= date_trunc('month', NOW())
         THEN total_cents ELSE 0 END), 0)::text AS ca_month_cents,
       COALESCE(SUM(CASE
         WHEN doc_type = 'invoice' AND status = 'paid'
              AND paid_at >= date_trunc('year', NOW())
         THEN total_cents ELSE 0 END), 0)::text AS ca_year_cents,
       COALESCE(SUM(CASE
         WHEN doc_type = 'invoice' AND status = 'sent'
              AND (due_date IS NULL OR due_date >= CURRENT_DATE)
         THEN total_cents ELSE 0 END), 0)::text AS invoices_pending_cents,
       COALESCE(SUM(CASE
         WHEN doc_type = 'invoice' AND status = 'sent'
              AND due_date IS NOT NULL AND due_date < CURRENT_DATE
         THEN total_cents ELSE 0 END), 0)::text AS invoices_overdue_cents,
       COUNT(*) FILTER (WHERE doc_type = 'contract' AND status = 'sent')::int AS contracts_pending_signature,
       COUNT(*) FILTER (WHERE doc_type = 'quote' AND status = 'sent')::int AS quotes_pending,
       COUNT(*) FILTER (WHERE doc_type = 'quote' AND status = 'expired' AND updated_at >= NOW() - INTERVAL '30 days')::int AS quotes_expired_last_30d,
       COUNT(*) FILTER (WHERE doc_type = 'invoice' AND status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days')::int AS invoices_paid_last_30d
     FROM admin_documents`
  );
  return {
    ca_month_cents: Number(row?.ca_month_cents ?? 0),
    ca_year_cents: Number(row?.ca_year_cents ?? 0),
    invoices_pending_cents: Number(row?.invoices_pending_cents ?? 0),
    invoices_overdue_cents: Number(row?.invoices_overdue_cents ?? 0),
    contracts_pending_signature: row?.contracts_pending_signature ?? 0,
    quotes_pending: row?.quotes_pending ?? 0,
    quotes_expired_last_30d: row?.quotes_expired_last_30d ?? 0,
    invoices_paid_last_30d: row?.invoices_paid_last_30d ?? 0,
  };
}

// ─── Envoi manuel d'une relance (utilisée par le bouton UI) ───────
export async function sendReminderAction(input: {
  docId: number;
  kind: "quote_reminder" | "invoice_reminder_1" | "invoice_reminder_2";
}): Promise<
  | { ok: true; provider: "whatsapp" | "telegram" }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const doc = await queryOne<{
      id: number;
      reference: string;
      client_name: string;
      total_cents: number;
      doc_type: string;
      due_date: string | null;
      created_at: string;
    }>(
      `SELECT id, reference, client_name, total_cents, doc_type, due_date, created_at
       FROM admin_documents WHERE id = $1`,
      [input.docId]
    );
    if (!doc) return { ok: false, error: "Document introuvable" };

    const amount = (doc.total_cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
    });
    const created = new Date(doc.created_at).toLocaleDateString("fr-FR");
    const due = doc.due_date
      ? new Date(doc.due_date).toLocaleDateString("fr-FR")
      : "—";

    const label =
      input.kind === "quote_reminder"
        ? "Relance devis"
        : input.kind === "invoice_reminder_1"
        ? "Relance facture n°1"
        : "Relance facture n°2 (mention pénalités)";

    const text =
      `📩 ${label}\n` +
      `\n` +
      `Doc : ${doc.reference}\n` +
      `Client : ${doc.client_name}\n` +
      `Montant : ${amount} € TTC\n` +
      `Émis le : ${created}\n` +
      (doc.due_date ? `Échéance : ${due}\n` : "") +
      `\n` +
      `Rappel : ouvre /admin/agents/admin?tab=documents pour le texte de relance à copier-coller (KB catégorie « relance »).`;

    const result = await notifyMickael(text);
    if (!result.ok) return { ok: false, error: result.error };
    await logEvent("admin", "reminder_notif_sent", {
      doc_id: input.docId,
      kind: input.kind,
    });
    return { ok: true, provider: result.provider };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
