// ──────────────────────────────────────────────────────────────────────
// PDF generator — devis, contrats, factures (pdf-lib pure JS)
// ──────────────────────────────────────────────────────────────────────
//
// Design :
//   - Une seule fonction publique par type de doc (buildQuotePdf,
//     buildContractPdf, buildInvoicePdf)
//   - Toutes reçoivent la config studio + le contenu du document
//   - Renvoient un Uint8Array (peut être uploadé sur Supabase ou envoyé
//     directement en réponse HTTP)
//   - Format A4, marges élégantes, typographie Helvetica intégrée à pdf-lib
//     (pas de download de police externe — build reproductible)
//   - Palette : fond ivoire à l'écran, gold pour les accents. Sur PDF
//     print noir sur blanc + gold #B8975A pour titres.
//
// Structure commune :
//   - En-tête studio (nom légal, adresse, contact) — à gauche
//   - Bloc doc (référence, date) — à droite
//   - Bloc client — au-dessus du contenu
//   - Contenu variable selon type
//   - Pied de page avec mentions légales

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

// ─── Types métier ────────────────────────────────────────────────────
export type StudioProfile = {
  company_legal_name: string;
  company_status: string;
  company_siret: string;
  company_rcs?: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  company_iban?: string;
  vat_status: "yes" | "no" | string;
  vat_rate?: string;
  vat_number?: string;
  legal_mentions?: string;
  contract_extra_clauses?: string;
};

export type Client = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type DocumentLine = {
  label: string;
  detail?: string;
  quantity: number;
  unit_price_cents: number; // HT
};

export type QuoteDoc = {
  reference: string;
  issue_date: string; // YYYY-MM-DD
  validity_days?: number;
  client: Client;
  wedding: {
    date?: string;
    location?: string;
    guest_count?: number;
    formula_name?: string;
  };
  lines: DocumentLine[];
  deposit_pct?: number; // ex: 30 = 30 %
  notes?: string;
};

export type InvoiceDoc = QuoteDoc & {
  due_date?: string; // date d'échéance
  payment_terms?: string;
  already_paid_cents?: number; // acompte déjà encaissé
};

export type ContractDoc = {
  reference: string;
  issue_date: string;
  client: Client;
  wedding: {
    date: string;
    location: string;
    guest_count?: number;
    ceremony_time?: string;
    end_time?: string;
  };
  formula_name: string;
  formula_description: string;
  price_cents: number;
  deposit_pct: number;
  cancellation_policy?: string;
  image_rights?: string;
  force_majeure?: string;
  jurisdiction?: string;
};

// ─── Constantes de style ─────────────────────────────────────────────
const PAGE_W = 595.28; // A4 portrait en points
const PAGE_H = 841.89;
const MARGIN = 50;
const GOLD = rgb(0.72, 0.59, 0.35); // #B8975A
const FOREST = rgb(0.18, 0.24, 0.18); // #2E3D2E
const INK = rgb(0.16, 0.15, 0.13);
const MUTED = rgb(0.47, 0.43, 0.36);
const RULE = rgb(0.85, 0.80, 0.70);

// ─── Helpers ─────────────────────────────────────────────────────────
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// pdf-lib n'a pas de text wrap intégré : on découpe manuellement en lignes
// selon la largeur maximale et la police.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Écrit un bloc de texte multi-ligne à partir d'une position ; renvoie
// la nouvelle position Y (bas du bloc).
function drawParagraph(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    maxWidth: number;
    lineGap?: number;
  }
): number {
  const color = opts.color ?? INK;
  const lineGap = opts.lineGap ?? opts.size * 1.5;
  let y = opts.y;
  for (const line of text.split("\n")) {
    for (const wrapped of wrapText(line, opts.font, opts.size, opts.maxWidth)) {
      page.drawText(wrapped, {
        x: opts.x,
        y,
        size: opts.size,
        font: opts.font,
        color,
      });
      y -= lineGap;
    }
  }
  return y;
}

// ─── En-tête + pied de page communs ──────────────────────────────────
type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  studio: StudioProfile,
  doc: { title: string; reference: string; date: string }
): number {
  // Titre décoratif à gauche
  page.drawText("ROMERO PHOTOGRAPHY", {
    x: MARGIN,
    y: PAGE_H - MARGIN - 8,
    size: 9,
    font: fonts.bold,
    color: GOLD,
  });
  page.drawText(doc.title, {
    x: MARGIN,
    y: PAGE_H - MARGIN - 32,
    size: 26,
    font: fonts.italic,
    color: FOREST,
  });

  // Ligne de séparation
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN - 46 },
    end: { x: MARGIN + 60, y: PAGE_H - MARGIN - 46 },
    thickness: 1,
    color: GOLD,
  });

  // Bloc identité studio (colonne gauche, sous le titre)
  let y = PAGE_H - MARGIN - 66;
  const sm = 8;
  const lineGap = 11;
  page.drawText(studio.company_legal_name, {
    x: MARGIN, y, size: 9, font: fonts.bold, color: INK,
  });
  y -= lineGap;
  y = drawParagraph(page, studio.company_address, {
    x: MARGIN, y, font: fonts.regular, size: sm, color: MUTED, maxWidth: 200, lineGap: 10,
  });
  page.drawText(studio.company_email, { x: MARGIN, y, size: sm, font: fonts.regular, color: MUTED });
  y -= lineGap;
  page.drawText(studio.company_phone, { x: MARGIN, y, size: sm, font: fonts.regular, color: MUTED });
  y -= lineGap;

  // Bloc doc (colonne droite)
  const rightX = PAGE_W - MARGIN - 200;
  page.drawText("RÉFÉRENCE", { x: rightX, y: PAGE_H - MARGIN - 20, size: 8, font: fonts.bold, color: GOLD });
  page.drawText(doc.reference, { x: rightX, y: PAGE_H - MARGIN - 34, size: 11, font: fonts.bold, color: INK });
  page.drawText("DATE D'ÉMISSION", { x: rightX, y: PAGE_H - MARGIN - 58, size: 8, font: fonts.bold, color: GOLD });
  page.drawText(formatDate(doc.date), { x: rightX, y: PAGE_H - MARGIN - 72, size: 11, font: fonts.regular, color: INK });

  return y - 10; // Y du bas de l'en-tête
}

function drawClientBlock(
  page: PDFPage,
  fonts: Fonts,
  client: Client,
  y: number
): number {
  page.drawText("DESTINATAIRE", {
    x: MARGIN, y, size: 8, font: fonts.bold, color: GOLD,
  });
  y -= 14;
  page.drawText(client.name, { x: MARGIN, y, size: 11, font: fonts.bold, color: INK });
  y -= 14;
  if (client.address) {
    y = drawParagraph(page, client.address, {
      x: MARGIN, y, font: fonts.regular, size: 9, color: INK, maxWidth: 260, lineGap: 12,
    });
  }
  const contact = [client.email, client.phone].filter(Boolean).join("  ·  ");
  if (contact) {
    page.drawText(contact, { x: MARGIN, y, size: 9, font: fonts.regular, color: MUTED });
    y -= 14;
  }
  return y - 6;
}

function drawFooter(page: PDFPage, fonts: Fonts, studio: StudioProfile) {
  const foot = [
    studio.company_legal_name,
    `SIRET ${studio.company_siret}`,
    studio.company_rcs ? `RCS ${studio.company_rcs}` : "",
    studio.vat_status === "yes" && studio.vat_number
      ? `TVA ${studio.vat_number}`
      : "TVA non applicable — art. 293 B du CGI",
  ]
    .filter(Boolean)
    .join(" · ");
  page.drawLine({
    start: { x: MARGIN, y: MARGIN + 24 },
    end: { x: PAGE_W - MARGIN, y: MARGIN + 24 },
    thickness: 0.5,
    color: RULE,
  });
  page.drawText(foot, {
    x: MARGIN,
    y: MARGIN + 12,
    size: 7,
    font: fonts.regular,
    color: MUTED,
  });
}

// ─── Table de lignes (partagée devis + facture) ──────────────────────
function drawLinesTable(
  page: PDFPage,
  fonts: Fonts,
  lines: DocumentLine[],
  y: number,
  vatRatePct: number,
  vatApplicable: boolean
): { y: number; subtotal: number; vat: number; total: number } {
  const colX = { label: MARGIN, qty: 340, unit: 400, total: 490 };
  const rowH = 22;

  // En-tête
  page.drawRectangle({
    x: MARGIN - 4, y: y - 3, width: PAGE_W - 2 * MARGIN + 8, height: 22,
    color: FOREST,
  });
  page.drawText("PRESTATION", { x: colX.label, y: y + 5, size: 8, font: fonts.bold, color: rgb(0.96, 0.94, 0.89) });
  page.drawText("QTÉ", { x: colX.qty, y: y + 5, size: 8, font: fonts.bold, color: rgb(0.96, 0.94, 0.89) });
  page.drawText("PU HT", { x: colX.unit, y: y + 5, size: 8, font: fonts.bold, color: rgb(0.96, 0.94, 0.89) });
  page.drawText("TOTAL HT", { x: colX.total, y: y + 5, size: 8, font: fonts.bold, color: rgb(0.96, 0.94, 0.89) });
  y -= 30;

  let subtotal = 0;
  for (const line of lines) {
    const lineTotal = line.quantity * line.unit_price_cents;
    subtotal += lineTotal;

    // Label (peut wrap si long)
    const labelLines = wrapText(line.label, fonts.bold, 10, 280);
    let localY = y;
    for (const l of labelLines) {
      page.drawText(l, { x: colX.label, y: localY, size: 10, font: fonts.bold, color: INK });
      localY -= 12;
    }
    if (line.detail) {
      for (const l of wrapText(line.detail, fonts.regular, 9, 280)) {
        page.drawText(l, { x: colX.label, y: localY, size: 9, font: fonts.italic, color: MUTED });
        localY -= 11;
      }
    }
    page.drawText(String(line.quantity), { x: colX.qty, y, size: 10, font: fonts.regular, color: INK });
    page.drawText(`${formatCents(line.unit_price_cents)} €`, { x: colX.unit, y, size: 10, font: fonts.regular, color: INK });
    page.drawText(`${formatCents(lineTotal)} €`, { x: colX.total, y, size: 10, font: fonts.bold, color: INK });

    y = Math.min(localY, y) - 8;
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: PAGE_W - MARGIN, y: y + 2 },
      thickness: 0.4,
      color: RULE,
    });
    y -= rowH - 8;
  }

  // Totaux
  y -= 10;
  const totalX = colX.unit;
  const totalXVal = colX.total;
  const vat = vatApplicable ? Math.round(subtotal * (vatRatePct / 100)) : 0;
  const total = subtotal + vat;

  page.drawText("SOUS-TOTAL HT", { x: totalX, y, size: 9, font: fonts.regular, color: MUTED });
  page.drawText(`${formatCents(subtotal)} €`, { x: totalXVal, y, size: 10, font: fonts.regular, color: INK });
  y -= 18;
  if (vatApplicable) {
    page.drawText(`TVA (${vatRatePct} %)`, { x: totalX, y, size: 9, font: fonts.regular, color: MUTED });
    page.drawText(`${formatCents(vat)} €`, { x: totalXVal, y, size: 10, font: fonts.regular, color: INK });
    y -= 18;
  }
  page.drawRectangle({
    x: totalX - 8, y: y - 5, width: PAGE_W - MARGIN - totalX + 10, height: 22,
    color: GOLD,
  });
  page.drawText("TOTAL TTC", { x: totalX, y: y + 2, size: 10, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText(`${formatCents(total)} €`, { x: totalXVal, y: y + 2, size: 12, font: fonts.bold, color: rgb(1, 1, 1) });
  y -= 30;

  return { y, subtotal, vat, total };
}

// ─── QUOTE (devis) ───────────────────────────────────────────────────
export async function buildQuotePdf(input: {
  studio: StudioProfile;
  doc: QuoteDoc;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const fonts = await loadFonts(pdf);

  let y = drawHeader(page, fonts, input.studio, {
    title: "Devis",
    reference: input.doc.reference,
    date: input.doc.issue_date,
  });

  y = drawClientBlock(page, fonts, input.doc.client, y - 20);

  // Bloc mariage (contexte)
  const w = input.doc.wedding;
  if (w.date || w.location || w.formula_name) {
    page.drawText("PROJET", { x: MARGIN, y, size: 8, font: fonts.bold, color: GOLD });
    y -= 14;
    const bits: string[] = [];
    if (w.formula_name) bits.push(`Formule : ${w.formula_name}`);
    if (w.date) bits.push(`Date du mariage : ${formatDate(w.date)}`);
    if (w.location) bits.push(`Lieu : ${w.location}`);
    if (w.guest_count) bits.push(`Invités attendus : ${w.guest_count}`);
    y = drawParagraph(page, bits.join("\n"), {
      x: MARGIN, y, font: fonts.regular, size: 10, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13,
    });
    y -= 14;
  }

  const vatApplicable = input.studio.vat_status === "yes";
  const vatRate = Number(input.studio.vat_rate) || 20;
  const totals = drawLinesTable(page, fonts, input.doc.lines, y, vatRate, vatApplicable);
  y = totals.y;

  // Acompte
  if (input.doc.deposit_pct) {
    const deposit = Math.round((totals.total * input.doc.deposit_pct) / 100);
    page.drawText(
      `Acompte à verser à la signature : ${formatCents(deposit)} € (${input.doc.deposit_pct} % du total)`,
      { x: MARGIN, y, size: 10, font: fonts.italic, color: FOREST }
    );
    y -= 20;
  }

  // Validité
  const validity = input.doc.validity_days ?? 30;
  page.drawText(
    `Devis valable ${validity} jours à compter de sa date d'émission.`,
    { x: MARGIN, y, size: 9, font: fonts.italic, color: MUTED }
  );
  y -= 16;

  // Notes
  if (input.doc.notes) {
    y -= 8;
    page.drawText("NOTES", { x: MARGIN, y, size: 8, font: fonts.bold, color: GOLD });
    y -= 12;
    y = drawParagraph(page, input.doc.notes, {
      x: MARGIN, y, font: fonts.regular, size: 9, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 12,
    });
  }

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}

// ─── INVOICE (facture) ───────────────────────────────────────────────
export async function buildInvoicePdf(input: {
  studio: StudioProfile;
  doc: InvoiceDoc;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const fonts = await loadFonts(pdf);

  let y = drawHeader(page, fonts, input.studio, {
    title: "Facture",
    reference: input.doc.reference,
    date: input.doc.issue_date,
  });

  // Échéance dans le bloc doc header (colonne droite)
  if (input.doc.due_date) {
    const rightX = PAGE_W - MARGIN - 200;
    page.drawText("ÉCHÉANCE", { x: rightX, y: PAGE_H - MARGIN - 96, size: 8, font: fonts.bold, color: GOLD });
    page.drawText(formatDate(input.doc.due_date), { x: rightX, y: PAGE_H - MARGIN - 110, size: 11, font: fonts.regular, color: INK });
  }

  y = drawClientBlock(page, fonts, input.doc.client, y - 20);

  const vatApplicable = input.studio.vat_status === "yes";
  const vatRate = Number(input.studio.vat_rate) || 20;
  const totals = drawLinesTable(page, fonts, input.doc.lines, y, vatRate, vatApplicable);
  y = totals.y;

  // Acompte déjà versé
  if (input.doc.already_paid_cents && input.doc.already_paid_cents > 0) {
    const remaining = Math.max(0, totals.total - input.doc.already_paid_cents);
    page.drawText(`Acompte déjà versé : - ${formatCents(input.doc.already_paid_cents)} €`, {
      x: MARGIN, y, size: 10, font: fonts.italic, color: MUTED,
    });
    y -= 16;
    page.drawText(`Reste à régler : ${formatCents(remaining)} €`, {
      x: MARGIN, y, size: 11, font: fonts.bold, color: FOREST,
    });
    y -= 20;
  }

  // Modalités de paiement
  if (input.doc.payment_terms) {
    page.drawText("MODALITÉS DE PAIEMENT", { x: MARGIN, y, size: 8, font: fonts.bold, color: GOLD });
    y -= 12;
    y = drawParagraph(page, input.doc.payment_terms, {
      x: MARGIN, y, font: fonts.regular, size: 9, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 12,
    });
    y -= 8;
  }

  // IBAN
  if (input.studio.company_iban) {
    page.drawText(`Paiement par virement — IBAN : ${input.studio.company_iban}`, {
      x: MARGIN, y, size: 9, font: fonts.italic, color: MUTED,
    });
    y -= 14;
  }

  // Mention de retard obligatoire (art L441-6 C. com.)
  y -= 6;
  page.drawText(
    "En cas de retard de paiement, application d'une pénalité de 3× le taux d'intérêt légal + indemnité forfaitaire de 40 € pour frais de recouvrement.",
    { x: MARGIN, y, size: 7, font: fonts.italic, color: MUTED }
  );

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}

// ─── CONTRACT (contrat) ──────────────────────────────────────────────
export async function buildContractPdf(input: {
  studio: StudioProfile;
  doc: ContractDoc;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  let page = pdf.addPage([PAGE_W, PAGE_H]);

  let y = drawHeader(page, fonts, input.studio, {
    title: "Contrat",
    reference: input.doc.reference,
    date: input.doc.issue_date,
  });
  y = drawClientBlock(page, fonts, input.doc.client, y - 20);

  // Helper : passe à une nouvelle page si y trop bas
  const bottom = MARGIN + 60;
  const ensureRoom = (need: number) => {
    if (y - need < bottom) {
      drawFooter(page, fonts, input.studio);
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN - 20;
    }
  };

  // Section : Objet du contrat
  page.drawText("1 · OBJET DU CONTRAT", { x: MARGIN, y, size: 10, font: fonts.bold, color: FOREST });
  y -= 16;
  const objet =
    `Le présent contrat a pour objet la prestation de reportage photographique du mariage de ${input.doc.client.name} ` +
    `célébré le ${formatDate(input.doc.wedding.date)} à ${input.doc.wedding.location}. ` +
    `Formule retenue : ${input.doc.formula_name}.`;
  y = drawParagraph(page, objet, {
    x: MARGIN, y, font: fonts.regular, size: 10, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13,
  });
  y -= 8;

  // Section : Prestations incluses
  ensureRoom(100);
  page.drawText("2 · PRESTATIONS INCLUSES", { x: MARGIN, y, size: 10, font: fonts.bold, color: FOREST });
  y -= 16;
  y = drawParagraph(page, input.doc.formula_description, {
    x: MARGIN, y, font: fonts.regular, size: 10, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13,
  });
  y -= 8;

  // Section : Prix et modalités
  ensureRoom(80);
  page.drawText("3 · PRIX ET MODALITÉS DE PAIEMENT", { x: MARGIN, y, size: 10, font: fonts.bold, color: FOREST });
  y -= 16;
  const deposit = Math.round((input.doc.price_cents * input.doc.deposit_pct) / 100);
  const balance = input.doc.price_cents - deposit;
  const vatApplicable = input.studio.vat_status === "yes";
  const vatText = vatApplicable
    ? `TTC (TVA ${input.studio.vat_rate ?? 20} % incluse)`
    : "TTC (non-assujetti à la TVA, art. 293 B du CGI)";
  y = drawParagraph(
    page,
    `Prix total : ${formatCents(input.doc.price_cents)} € ${vatText}.\n` +
      `Acompte de ${input.doc.deposit_pct} % (${formatCents(deposit)} €) à verser à la signature du présent contrat.\n` +
      `Solde de ${formatCents(balance)} € à régler au plus tard le jour du mariage.`,
    { x: MARGIN, y, font: fonts.regular, size: 10, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13 }
  );
  y -= 8;

  // Section : Annulation
  ensureRoom(80);
  page.drawText("4 · ANNULATION", { x: MARGIN, y, size: 10, font: fonts.bold, color: FOREST });
  y -= 16;
  const cancel =
    input.doc.cancellation_policy ??
    "En cas d'annulation par le client à moins de 90 jours du mariage, l'acompte reste acquis au studio. En cas d'annulation par le studio pour cas de force majeure, l'acompte sera intégralement remboursé et le studio proposera un confrère de qualité équivalente.";
  y = drawParagraph(page, cancel, {
    x: MARGIN, y, font: fonts.regular, size: 10, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13,
  });
  y -= 8;

  // Section : Droit à l'image
  ensureRoom(80);
  page.drawText("5 · DROIT À L'IMAGE", { x: MARGIN, y, size: 10, font: fonts.bold, color: FOREST });
  y -= 16;
  const rights =
    input.doc.image_rights ??
    "Le client autorise le studio à utiliser une sélection des photographies pour la promotion de son activité (site web, réseaux sociaux, portfolio, concours photo). Le client peut à tout moment demander le retrait d'une image le concernant.";
  y = drawParagraph(page, rights, {
    x: MARGIN, y, font: fonts.regular, size: 10, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13,
  });
  y -= 8;

  // Section : Force majeure
  ensureRoom(60);
  page.drawText("6 · FORCE MAJEURE", { x: MARGIN, y, size: 10, font: fonts.bold, color: FOREST });
  y -= 16;
  const fm =
    input.doc.force_majeure ??
    "En cas d'événement de force majeure empêchant l'exécution du contrat (maladie grave, décès, restrictions sanitaires, catastrophe naturelle), les parties conviendront ensemble d'un report ou d'un remboursement au prorata des prestations non réalisées.";
  y = drawParagraph(page, fm, {
    x: MARGIN, y, font: fonts.regular, size: 10, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13,
  });
  y -= 8;

  // Clauses additionnelles éventuelles
  if (input.studio.contract_extra_clauses) {
    ensureRoom(80);
    page.drawText("7 · CLAUSES ADDITIONNELLES", { x: MARGIN, y, size: 10, font: fonts.bold, color: FOREST });
    y -= 16;
    y = drawParagraph(page, input.studio.contract_extra_clauses, {
      x: MARGIN, y, font: fonts.regular, size: 10, color: INK, maxWidth: PAGE_W - 2 * MARGIN, lineGap: 13,
    });
    y -= 8;
  }

  // Section : Juridiction
  ensureRoom(60);
  const juridiction = input.doc.jurisdiction ?? "tribunal de Nice";
  page.drawText(`En cas de litige, compétence exclusive du ${juridiction}.`, {
    x: MARGIN, y, size: 9, font: fonts.italic, color: MUTED,
  });
  y -= 30;

  // Signatures
  ensureRoom(120);
  page.drawText("Fait en deux exemplaires originaux.", { x: MARGIN, y, size: 9, font: fonts.italic, color: MUTED });
  y -= 30;
  const halfW = (PAGE_W - 2 * MARGIN) / 2 - 15;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: MARGIN + halfW, y }, thickness: 0.5, color: RULE,
  });
  page.drawLine({
    start: { x: MARGIN + halfW + 30, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: RULE,
  });
  y -= 12;
  page.drawText("Le studio", { x: MARGIN, y, size: 8, font: fonts.bold, color: MUTED });
  page.drawText("Le client", { x: MARGIN + halfW + 30, y, size: 8, font: fonts.bold, color: MUTED });

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}
