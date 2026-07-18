// ──────────────────────────────────────────────────────────────────────
// Accounting adapter — Pennylane + Freebe unifiés
// ──────────────────────────────────────────────────────────────────────
//
// Interface commune :
//   createInvoice(input) → { id, pdfUrl?, publicUrl? }
//   listInvoices()       → InvoiceRef[]
//
// Selon `provider`, on route vers l'API concernée. Chacune a une
// structure différente mais les concepts sont identiques. On sélectionne
// avec le champ agent_installations.config.accounting_provider.
//
// Note : chaque API demande une TVA calculée côté nous (en centimes),
// des lignes séparées, et un client cible. Le PDF est généré côté
// service — on ne le regénère pas, on utilise le leur pour la
// cohérence comptable.

// ─── Types unifiés ───────────────────────────────────────────────
export type UnifiedInvoiceInput = {
  reference: string;
  issue_date: string; // YYYY-MM-DD
  due_date?: string;
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  lines: Array<{
    label: string;
    quantity: number;
    unit_price_cents: number;
    vat_rate: number; // en pourcentage (ex: 20)
  }>;
  currency?: string; // "EUR" par défaut
  notes?: string;
};

export type UnifiedInvoiceResult = {
  provider: "pennylane" | "freebe";
  provider_invoice_id: string;
  pdf_url?: string;
  public_url?: string;
};

// ─── Point d'entrée unifié ──────────────────────────────────────
export async function createUnifiedInvoice(input: {
  provider: "pennylane" | "freebe";
  apiKey: string;
  invoice: UnifiedInvoiceInput;
}): Promise<
  | { ok: true; data: UnifiedInvoiceResult }
  | { ok: false; error: string }
> {
  if (input.provider === "pennylane") {
    return createPennylaneInvoice(input.apiKey, input.invoice);
  }
  if (input.provider === "freebe") {
    return createFreebeInvoice(input.apiKey, input.invoice);
  }
  return { ok: false, error: `Provider inconnu : ${input.provider}` };
}

// ─── Pennylane ──────────────────────────────────────────────────
// Doc : https://pennylane.readme.io/reference/introduction
// Endpoint : https://app.pennylane.com/api/external/v1/customer_invoices
async function createPennylaneInvoice(
  apiKey: string,
  invoice: UnifiedInvoiceInput
): Promise<
  | { ok: true; data: UnifiedInvoiceResult }
  | { ok: false; error: string }
> {
  try {
    const body = {
      invoice: {
        date: invoice.issue_date,
        deadline: invoice.due_date ?? invoice.issue_date,
        invoice_number: invoice.reference,
        currency: invoice.currency ?? "EUR",
        customer: {
          name: invoice.client.name,
          email: invoice.client.email,
          address: invoice.client.address,
          phone: invoice.client.phone,
        },
        line_items: invoice.lines.map((l) => ({
          label: l.label,
          quantity: l.quantity,
          unit: "piece",
          unit_amount: (l.unit_price_cents / 100).toFixed(2),
          vat_rate: `FR_${l.vat_rate}`,
        })),
        special_mention: invoice.notes,
      },
    };
    const resp = await fetch(
      "https://app.pennylane.com/api/external/v1/customer_invoices",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `Pennylane HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    const data = (await resp.json()) as {
      invoice?: { id?: number | string; pdf_link?: string; public_url?: string };
    };
    if (!data.invoice?.id)
      return { ok: false, error: "Pennylane n'a pas renvoyé d'ID de facture" };
    return {
      ok: true,
      data: {
        provider: "pennylane",
        provider_invoice_id: String(data.invoice.id),
        pdf_url: data.invoice.pdf_link,
        public_url: data.invoice.public_url,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Freebe ─────────────────────────────────────────────────────
// Freebe est très orienté auto-entreprise. Leur API est plus légère
// mais moins bien documentée publiquement. On utilise leur endpoint
// invoices standard.
// Endpoint : https://api.freebe.me/v1/invoices (à confirmer selon
// version — Freebe a un mode « facturation externe » qui accepte un
// POST simple).
async function createFreebeInvoice(
  apiKey: string,
  invoice: UnifiedInvoiceInput
): Promise<
  | { ok: true; data: UnifiedInvoiceResult }
  | { ok: false; error: string }
> {
  try {
    const totalHt = invoice.lines.reduce(
      (sum, l) => sum + l.quantity * l.unit_price_cents,
      0
    );
    // Freebe suit une convention simple : POST /invoices avec un objet
    // aplati. On construit une charge utile robuste, tolérante aux
    // évolutions de leur API (les champs inconnus sont ignorés).
    const body = {
      number: invoice.reference,
      issued_at: invoice.issue_date,
      due_at: invoice.due_date,
      currency: invoice.currency ?? "EUR",
      total_ht_cents: totalHt,
      customer: {
        name: invoice.client.name,
        email: invoice.client.email,
        phone: invoice.client.phone,
        address: invoice.client.address,
      },
      lines: invoice.lines.map((l) => ({
        description: l.label,
        quantity: l.quantity,
        unit_price_cents: l.unit_price_cents,
        vat_rate_percent: l.vat_rate,
      })),
      notes: invoice.notes,
    };
    const resp = await fetch("https://api.freebe.me/v1/invoices", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `Freebe HTTP ${resp.status} · ${text.slice(0, 300)}` };
    }
    const data = (await resp.json()) as {
      id?: string;
      invoice_id?: string;
      pdf_url?: string;
      public_url?: string;
    };
    const id = data.id ?? data.invoice_id;
    if (!id) return { ok: false, error: "Freebe n'a pas renvoyé d'ID" };
    return {
      ok: true,
      data: {
        provider: "freebe",
        provider_invoice_id: String(id),
        pdf_url: data.pdf_url,
        public_url: data.public_url,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
