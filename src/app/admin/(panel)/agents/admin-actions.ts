"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, queryOne, execute, withTransaction } from "@/lib/db";
import { getAgent, logEvent } from "@/lib/agents";
import { extractFromBrief } from "@/lib/admin-brain";
import {
  buildContractPdf,
  buildInvoicePdf,
  buildQuotePdf,
  type StudioProfile,
  type QuoteDoc,
  type ContractDoc,
  type InvoiceDoc,
} from "@/lib/pdf-generator";
import { sendPdfToSign, type YousignEnv } from "@/lib/yousign";
import {
  createUnifiedInvoice,
  type UnifiedInvoiceInput,
} from "@/lib/accounting";
import { uploadDocumentServer } from "@/lib/storage";

// ─── Types communs ────────────────────────────────────────────────
type DocKind = "quote" | "contract" | "invoice";
export type AdminDocRow = {
  id: number;
  doc_type: DocKind;
  reference: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
  guest_count: number | null;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  vat_rate: string;
  content: Record<string, unknown>;
  status: string;
  yousign_procedure_id: string | null;
  yousign_signed_at: string | null;
  accounting_invoice_id: string | null;
  accounting_provider: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  signed_pdf_url: string | null;
  sent_at: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function revalidate() {
  revalidatePath("/admin/agents/admin");
}

// ─── Studio profile (extrait de la config) ────────────────────────
async function loadStudioProfile(): Promise<
  { ok: true; profile: StudioProfile } | { ok: false; error: string }
> {
  const inst = await getAgent("admin");
  if (!inst) return { ok: false, error: "Agent admin introuvable" };
  const cfg = inst.config as Record<string, string>;

  // Mapping legacy company_* / vat_status → nouveaux Studio Settings :
  //   legal_name, legal_status, siret, legal_address, rcs_city,
  //   contact_email, contact_phone, iban, tva_applicable (bool str)
  // On accepte les deux formats pour la retrocompat, en donnant priorite
  // aux nouvelles clefs (Studio Settings unifie).
  const map = {
    company_legal_name: cfg.legal_name || cfg.company_legal_name || "Mickael Romero",
    company_status:
      cfg.legal_status ||
      cfg.company_status ||
      "Micro-entrepreneur — Entreprise Individuelle",
    company_siret: cfg.siret || cfg.company_siret || "",
    company_rcs: cfg.rcs_city || cfg.company_rcs || "",
    company_address: cfg.legal_address || cfg.company_address || "",
    company_email:
      cfg.notification_email ||
      cfg.contact_email ||
      cfg.company_email ||
      "romerophotography.contact@gmail.com",
    company_phone: cfg.public_phone || cfg.contact_phone || cfg.company_phone || "",
    company_iban: cfg.iban || cfg.company_iban || "",
    // TVA : par defaut franchise en base pour micro-entrepreneur (non
    // applicable, art 293B). Si Mickael passe au reel, cocher vat_applicable
    // en Studio Settings.
    vat_status:
      cfg.vat_applicable === "yes" || cfg.vat_applicable === "true" || cfg.vat_status === "yes"
        ? "yes"
        : "no",
    vat_rate: cfg.vat_rate || "20",
    vat_number: cfg.vat_number || "",
  };
  const missing: string[] = [];
  // On exige seulement les champs vraiment necessaires pour le PDF legal.
  if (!map.company_siret) missing.push("SIRET");
  if (!map.company_address) missing.push("adresse");
  if (!map.company_phone) missing.push("telephone");
  if (missing.length > 0)
    return {
      ok: false,
      error: `Champs manquants dans Studio Settings : ${missing.join(", ")}. Va sur /admin/agents/studio pour les completer.`,
    };
  return {
    ok: true,
    profile: {
      company_legal_name: map.company_legal_name,
      company_status: map.company_status,
      company_siret: map.company_siret,
      company_rcs: map.company_rcs,
      company_address: map.company_address,
      company_email: map.company_email,
      company_phone: map.company_phone,
      company_iban: map.company_iban,
      vat_status: map.vat_status,
      vat_rate: map.vat_rate,
      vat_number: map.vat_number,
      legal_mentions: cfg.legal_mentions,
      contract_extra_clauses: cfg.contract_extra_clauses,
    },
  };
}

// ─── Numérotation séquentielle par type ───────────────────────────
async function nextReference(docType: DocKind): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = docType === "quote" ? "DEV" : docType === "contract" ? "CT" : "FA";

  // Increment atomique via WITH ... UPDATE ... RETURNING pour ne PAS
  // avoir de collision entre 2 requêtes simultanées.
  const row = await withTransaction(async (tx) => {
    // Init si nécessaire
    await tx.execute(
      `INSERT INTO admin_doc_counters (doc_type, year, next_number)
       VALUES ($1, $2, 1)
       ON CONFLICT (doc_type, year) DO NOTHING`,
      [docType, year]
    );
    const r = await tx.queryOne<{ next_number: number }>(
      `UPDATE admin_doc_counters
       SET next_number = next_number + 1
       WHERE doc_type = $1 AND year = $2
       RETURNING next_number - 1 AS next_number`,
      [docType, year]
    );
    return r;
  });

  const n = row?.next_number ?? 1;
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}

// ─── Calcul des totaux depuis les lignes ──────────────────────────
function computeTotals(
  lines: Array<{ quantity: number; unit_price_cents: number }>,
  vatRate: number,
  vatApplicable: boolean
): { subtotal: number; vat: number; total: number } {
  const subtotal = lines.reduce(
    (s, l) => s + l.quantity * l.unit_price_cents,
    0
  );
  const vat = vatApplicable ? Math.round((subtotal * vatRate) / 100) : 0;
  return { subtotal, vat, total: subtotal + vat };
}

// ─── Upload PDF vers Supabase Storage ─────────────────────────────
async function uploadPdf(
  reference: string,
  bytes: Uint8Array
): Promise<string> {
  const path = `${reference}-${Date.now()}.pdf`;
  const buf = Buffer.from(bytes);
  return uploadDocumentServer(path, buf, "application/pdf");
}

// ─── Extraction depuis brief (étape 1 UI) ─────────────────────────
export async function extractDocumentAction(input: {
  kind: DocKind;
  brief: string;
}): Promise<
  | { ok: true; extraction: Record<string, unknown> }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const r = await extractFromBrief({ kind: input.kind, brief: input.brief });
    if (!r.ok) return r;
    return { ok: true, extraction: r.data as unknown as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Création complète (extraction + PDF + insert) ────────────────
export async function createDocumentAction(input: {
  kind: DocKind;
  data: Record<string, unknown>;
}): Promise<
  | { ok: true; documentId: number; reference: string; pdfUrl: string }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const profile = await loadStudioProfile();
    if (!profile.ok) return profile;

    const reference = await nextReference(input.kind);
    const vatApplicable = profile.profile.vat_status === "yes";
    const vatRate = Number(profile.profile.vat_rate) || 20;

    let pdfBytes: Uint8Array;
    let content: Record<string, unknown> = input.data;
    let totals = { subtotal: 0, vat: 0, total: 0 };
    let clientName = "";
    let clientEmail: string | null = null;
    let clientPhone: string | null = null;
    let clientAddress: string | null = null;
    let weddingDate: string | null = null;
    let weddingLocation: string | null = null;
    let guestCount: number | null = null;
    let dueDate: string | null = null;

    if (input.kind === "quote") {
      const d = input.data as unknown as QuoteDoc;
      const quote: QuoteDoc = {
        ...d,
        reference,
        issue_date: d.issue_date || new Date().toISOString().slice(0, 10),
      };
      totals = computeTotals(quote.lines, vatRate, vatApplicable);
      clientName = quote.client.name;
      clientEmail = quote.client.email ?? null;
      clientPhone = quote.client.phone ?? null;
      clientAddress = quote.client.address ?? null;
      weddingDate = quote.wedding.date ?? null;
      weddingLocation = quote.wedding.location ?? null;
      guestCount = quote.wedding.guest_count ?? null;
      pdfBytes = await buildQuotePdf({ studio: profile.profile, doc: quote });
      content = quote as unknown as Record<string, unknown>;
    } else if (input.kind === "contract") {
      const d = input.data as unknown as ContractDoc;
      const contract: ContractDoc = {
        ...d,
        reference,
        issue_date: d.issue_date || new Date().toISOString().slice(0, 10),
      };
      totals = {
        subtotal: contract.price_cents,
        vat: 0,
        total: contract.price_cents,
      };
      clientName = contract.client.name;
      clientEmail = contract.client.email ?? null;
      clientPhone = contract.client.phone ?? null;
      clientAddress = contract.client.address ?? null;
      weddingDate = contract.wedding.date ?? null;
      weddingLocation = contract.wedding.location ?? null;
      guestCount = contract.wedding.guest_count ?? null;
      pdfBytes = await buildContractPdf({
        studio: profile.profile,
        doc: contract,
      });
      content = contract as unknown as Record<string, unknown>;
    } else {
      const d = input.data as unknown as InvoiceDoc;
      const invoice: InvoiceDoc = {
        ...d,
        reference,
        issue_date: d.issue_date || new Date().toISOString().slice(0, 10),
      };
      totals = computeTotals(invoice.lines, vatRate, vatApplicable);
      clientName = invoice.client.name;
      clientEmail = invoice.client.email ?? null;
      clientPhone = invoice.client.phone ?? null;
      clientAddress = invoice.client.address ?? null;
      weddingDate = invoice.wedding.date ?? null;
      weddingLocation = invoice.wedding.location ?? null;
      guestCount = invoice.wedding.guest_count ?? null;
      dueDate = invoice.due_date ?? null;
      pdfBytes = await buildInvoicePdf({ studio: profile.profile, doc: invoice });
      content = invoice as unknown as Record<string, unknown>;
    }

    // Upload PDF
    const pdfUrl = await uploadPdf(reference, pdfBytes);

    // Persist
    const inserted = await queryOne<{ id: number }>(
      `INSERT INTO admin_documents (
        doc_type, reference,
        client_name, client_email, client_phone, client_address,
        wedding_date, wedding_location, guest_count,
        subtotal_cents, vat_cents, total_cents, vat_rate,
        content, pdf_url, due_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16)
       RETURNING id`,
      [
        input.kind,
        reference,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        weddingDate,
        weddingLocation,
        guestCount,
        totals.subtotal,
        totals.vat,
        totals.total,
        vatApplicable ? vatRate : 0,
        JSON.stringify(content),
        pdfUrl,
        dueDate,
      ]
    );
    if (!inserted?.id) return { ok: false, error: "Insert échoué" };

    await logEvent("admin", `${input.kind}_created`, {
      document_id: inserted.id,
      reference,
      total_cents: totals.total,
    });
    revalidate();
    return { ok: true, documentId: inserted.id, reference, pdfUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Envoi à signer via Yousign ───────────────────────────────────
export async function sendToYousignAction(
  documentId: number
): Promise<
  | { ok: true; signatureRequestId: string }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const doc = await queryOne<AdminDocRow>(
      `SELECT * FROM admin_documents WHERE id = $1`,
      [documentId]
    );
    if (!doc) return { ok: false, error: "Document introuvable" };
    if (!doc.pdf_url) return { ok: false, error: "PDF pas encore généré" };
    if (!doc.client_email)
      return { ok: false, error: "E-mail client manquant" };

    const inst = await getAgent("admin");
    const cfg = inst?.config as { yousign_api_key?: string; yousign_environment?: string } | undefined;
    if (!cfg?.yousign_api_key)
      return { ok: false, error: "Clé API Yousign manquante dans la configuration" };
    const env: YousignEnv = cfg.yousign_environment === "production" ? "production" : "sandbox";

    // Télécharge le PDF pour l'envoyer à Yousign
    const pdfResp = await fetch(doc.pdf_url);
    if (!pdfResp.ok)
      return { ok: false, error: `Téléchargement PDF échoué : HTTP ${pdfResp.status}` };
    const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());

    // Split client name → prénom / nom (best effort)
    const parts = doc.client_name.trim().split(/\s+/);
    const firstName = parts[0] || "Client";
    const lastName = parts.slice(1).join(" ") || parts[0];

    const result = await sendPdfToSign({
      env,
      apiKey: cfg.yousign_api_key,
      pdfBytes,
      filename: `${doc.reference}.pdf`,
      documentName: `${doc.doc_type} ${doc.reference}`,
      signer: {
        first_name: firstName,
        last_name: lastName,
        email: doc.client_email,
        phone_number: doc.client_phone ?? undefined,
      },
    });

    if (!result.ok) {
      await logEvent(
        "admin",
        `${doc.doc_type}_yousign_error`,
        { document_id: documentId, error: result.error },
        false
      );
      return { ok: false, error: result.error };
    }

    await execute(
      `UPDATE admin_documents
       SET yousign_procedure_id = $1, status = 'sent', sent_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [result.signatureRequestId, documentId]
    );
    await logEvent("admin", `${doc.doc_type}_yousign_sent`, {
      document_id: documentId,
      signature_request_id: result.signatureRequestId,
    });
    revalidate();
    return { ok: true, signatureRequestId: result.signatureRequestId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Envoi comptable (facture → Pennylane/Freebe) ─────────────────
export async function pushToAccountingAction(
  documentId: number
): Promise<
  | { ok: true; providerInvoiceId: string }
  | { ok: false; error: string }
> {
  try {
    await requireUser();
    const doc = await queryOne<AdminDocRow>(
      `SELECT * FROM admin_documents WHERE id = $1`,
      [documentId]
    );
    if (!doc) return { ok: false, error: "Document introuvable" };
    if (doc.doc_type !== "invoice")
      return { ok: false, error: "Seules les factures sont envoyées en compta" };
    if (doc.accounting_invoice_id)
      return { ok: false, error: "Cette facture est déjà en compta" };

    const inst = await getAgent("admin");
    const cfg = inst?.config as {
      accounting_provider?: string;
      accounting_api_key?: string;
      vat_status?: string;
      vat_rate?: string;
    } | undefined;
    const provider = cfg?.accounting_provider;
    const apiKey = cfg?.accounting_api_key;
    if (!provider || provider === "none" || !apiKey)
      return {
        ok: false,
        error: "Provider comptable ou clé API manquant dans la configuration",
      };
    if (provider !== "pennylane" && provider !== "freebe")
      return { ok: false, error: `Provider inconnu : ${provider}` };

    const content = doc.content as unknown as InvoiceDoc;
    const vatApplicable = cfg?.vat_status === "yes";
    const vatRate = Number(cfg?.vat_rate) || 0;

    const payload: UnifiedInvoiceInput = {
      reference: doc.reference,
      issue_date: content.issue_date,
      due_date: content.due_date,
      client: {
        name: doc.client_name,
        email: doc.client_email ?? undefined,
        phone: doc.client_phone ?? undefined,
        address: doc.client_address ?? undefined,
      },
      lines: content.lines.map((l) => ({
        label: l.label,
        quantity: l.quantity,
        unit_price_cents: l.unit_price_cents,
        vat_rate: vatApplicable ? vatRate : 0,
      })),
      currency: "EUR",
      notes: content.notes,
    };

    const result = await createUnifiedInvoice({
      provider,
      apiKey,
      invoice: payload,
    });
    if (!result.ok) {
      await logEvent("admin", "invoice_accounting_error", { document_id: documentId, error: result.error }, false);
      return { ok: false, error: result.error };
    }

    await execute(
      `UPDATE admin_documents
       SET accounting_invoice_id = $1, accounting_provider = $2, updated_at = NOW()
       WHERE id = $3`,
      [result.data.provider_invoice_id, provider, documentId]
    );
    await logEvent("admin", "invoice_accounting_synced", {
      document_id: documentId,
      provider,
      provider_invoice_id: result.data.provider_invoice_id,
    });
    revalidate();
    return { ok: true, providerInvoiceId: result.data.provider_invoice_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Statut & maintenance ─────────────────────────────────────────
export async function setDocumentStatusAction(
  documentId: number,
  status: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    const allowed = ["draft", "sent", "signed", "paid", "cancelled", "expired"];
    if (!allowed.includes(status))
      return { ok: false, error: `Statut invalide : ${status}` };
    const paidField = status === "paid" ? ", paid_at = NOW()" : "";
    await execute(
      `UPDATE admin_documents SET status = $1${paidField}, updated_at = NOW() WHERE id = $2`,
      [status, documentId]
    );
    await logEvent("admin", "document_status_changed", {
      document_id: documentId,
      status,
    });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteDocumentAction(
  documentId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireUser();
    await execute(`DELETE FROM admin_documents WHERE id = $1`, [documentId]);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Lecture (utilisée par les composants server) ────────────────
export async function listDocumentsByType(
  docType: DocKind,
  limit = 50
): Promise<AdminDocRow[]> {
  return query<AdminDocRow>(
    `SELECT * FROM admin_documents
     WHERE doc_type = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [docType, limit]
  );
}

export async function getDocumentById(
  id: number
): Promise<AdminDocRow | null> {
  return queryOne<AdminDocRow>(
    `SELECT * FROM admin_documents WHERE id = $1`,
    [id]
  );
}
