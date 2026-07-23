import fs from "node:fs";
const p = "src/lib/pdf-generator.ts";
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf("function drawLinesTable(");
const end = s.indexOf("// ─── CONTRAT ─");
if (start < 0 || end < 0) throw new Error("markers not found");

const block = `// En-tête de tableau (réutilisé sur chaque page de continuation).
function drawTableHeader(page: PDFPage, fonts: Fonts, y: number): number {
  const xs = colBounds();
  const headH = 24;
  page.drawRectangle({ x: MARGIN, y: y - headH, width: CONTENT_W, height: headH, color: SAGE });
  COLS.forEach((c, i) => {
    centerText(page, c.label, (xs[i] + xs[i + 1]) / 2, y - headH + 8.5, 7.5, fonts.bold, WHITE);
  });
  return y - headH;
}

// Zone basse à laisser libre sur la page où sont dessinés le tableau et
// le footer décoratif.
const TABLE_FLOOR = MARGIN + 74;
// Hauteur nécessaire pour la zone totaux + blocs (acompte/signature).
const BOTTOM_SECTION_H = 210;

// Dessine le tableau avec pagination automatique : si une ligne ne tient
// pas au-dessus du plancher, on ouvre une nouvelle page et on réaffiche
// l'en-tête. Retourne la page courante et le y en bas du tableau.
function drawLinesTable(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  lines: DocumentLine[],
  startY: number,
  vatRatePct: number,
  vatApplicable: boolean
): { page: PDFPage; y: number; subtotal: number; vat: number; total: number } {
  const xs = colBounds();
  const labelW = COLS[0].w * CONTENT_W - 14;
  const detailW = COLS[1].w * CONTENT_W - 24;
  const lineH = 11;
  const padV = 9;
  const minRow = 30;

  let curPage = page;
  let y = drawTableHeader(curPage, fonts, startY);

  const rows = lines.map((line) => {
    const labelLines = wrapText(line.label, fonts.bold, 8.5, labelW);
    const bullets = String(line.detail || "")
      .split("\\n")
      .map((t) => t.replace(/^[-*·•]\\s*/, "").trim())
      .filter(Boolean)
      .map((t) => wrapText(t, fonts.regular, 8, detailW));
    const detailLines = bullets.reduce((n, bl) => n + bl.length, 0);
    const contentH = Math.max(labelLines.length, detailLines) * lineH + 2 * padV;
    return { line, labelLines, bullets, h: Math.max(minRow, contentH) };
  });

  let subtotal = 0;
  for (const r of rows) {
    const h = r.h;
    // Nouvelle page si la ligne ne tient pas.
    if (y - h < TABLE_FLOOR) {
      curPage = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
      drawTopRightCurve(curPage);
      y = drawTableHeader(curPage, fonts, PAGE_H - MARGIN - 20);
    }
    const rowTop = y;
    const rowBottom = y - h;
    const lineTotal = r.line.quantity * r.line.unit_price_cents;
    subtotal += lineTotal;

    curPage.drawRectangle({
      x: MARGIN, y: rowBottom, width: CONTENT_W, height: h,
      borderColor: RULE, borderWidth: 0.6,
    });
    for (let i = 1; i < xs.length - 1; i++) {
      curPage.drawLine({
        start: { x: xs[i], y: rowTop }, end: { x: xs[i], y: rowBottom },
        thickness: 0.6, color: RULE,
      });
    }

    let ly = rowTop - padV - 8 + ((h - 2 * padV) - r.labelLines.length * lineH) / 2;
    if (ly > rowTop - padV - 8) ly = rowTop - padV - 8;
    for (const l of r.labelLines) {
      if (ly < rowBottom + 4) break;
      curPage.drawText(l, { x: xs[0] + 7, y: ly, size: 8.5, font: fonts.bold, color: INK });
      ly -= lineH;
    }

    let dy = rowTop - padV - 6;
    for (const bulletLines of r.bullets) {
      if (dy < rowBottom + 4) break;
      curPage.drawCircle({ x: xs[1] + 9, y: dy + 3, size: 1.2, color: INK });
      for (const bl of bulletLines) {
        if (dy < rowBottom + 4) break;
        curPage.drawText(bl, { x: xs[1] + 15, y: dy, size: 8, font: fonts.regular, color: INK });
        dy -= lineH;
      }
    }

    const mid = rowTop - h / 2 - 3;
    centerText(curPage, String(r.line.quantity), (xs[2] + xs[3]) / 2, mid, 8.5, fonts.regular, INK);
    centerText(curPage, formatCents(r.line.unit_price_cents) + " EUR", (xs[3] + xs[4]) / 2, mid, 8.5, fonts.regular, INK);
    centerText(curPage, formatCents(lineTotal) + " EUR", (xs[4] + xs[5]) / 2, mid, 8.5, fonts.regular, INK);

    y = rowBottom;
  }

  const vat = vatApplicable ? Math.round(subtotal * (vatRatePct / 100)) : 0;
  return { page: curPage, y, subtotal, vat, total: subtotal + vat };
}

/** Bandeau de total aligné à droite. */
function drawTotalBar(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  amountCents: number,
  y: number,
  opts?: { muted?: boolean }
): number {
  const barH = 23;
  const barW = CONTENT_W * 0.585;
  const barX = PAGE_W - MARGIN - barW;
  const valueW = barW * 0.34;

  page.drawRectangle({
    x: barX, y: y - barH, width: barW - valueW, height: barH,
    color: opts?.muted ? SAGE_LIGHT : SAGE,
  });
  page.drawRectangle({
    x: barX + barW - valueW, y: y - barH, width: valueW, height: barH,
    borderColor: RULE, borderWidth: 0.6, color: WHITE,
  });
  page.drawText(label, {
    x: barX + 12, y: y - barH + 8, size: 8.5,
    font: fonts.bold, color: opts?.muted ? FOREST : WHITE,
  });
  rightAlign(page, formatCents(amountCents) + " EUR", PAGE_W - MARGIN - 10, y - barH + 8, 9.5, fonts.bold, INK);
  return y - barH - 6;
}

// ─── Blocs bas ───────────────────────────────────────────────────────
function drawDepositBox(
  page: PDFPage,
  fonts: Fonts,
  pct: number,
  amountCents: number,
  x: number,
  y: number,
  w: number
): void {
  const h = 80;
  page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: RULE, borderWidth: 0.9 });
  const cx = x + w / 2;
  page.drawCircle({ x: cx, y, size: 10, color: WHITE, borderColor: RULE, borderWidth: 0.9 });
  page.drawSvgPath(
    "M 0 0 C -2.6 -2.8 -5.4 -1 -5.4 1.5 C -5.4 3.9 -2.8 5.6 0 8 C 2.8 5.6 5.4 3.9 5.4 1.5 C 5.4 -1 2.6 -2.8 0 0 Z",
    { x: cx, y: y + 3, borderColor: SAGE, borderWidth: 1.1 }
  );
  centerText(page, "ACOMPTE A LA RESERVATION", cx, y - 28, 8, fonts.regular, MUTED);
  centerText(page, pct + "%", cx, y - 53, 21, fonts.bold, INK);
  centerText(page, "soit " + formatCents(amountCents) + " EUR", cx, y - 70, 9, fonts.regular, MUTED);
}

function drawSignatureBox(
  page: PDFPage,
  fonts: Fonts,
  x: number,
  y: number,
  w: number,
  title = "SIGNATURE"
): void {
  page.drawText(title, { x, y, size: 10, font: fonts.bold, color: FOREST });
  page.drawText('(Precedee de la mention "Bon pour accord")', {
    x, y: y - 13, size: 7.5, font: fonts.regular, color: MUTED,
  });
  page.drawRectangle({
    x, y: y - 64, width: w, height: 44,
    borderColor: FOREST, borderWidth: 0.9,
  });
}

function drawLabeledBox(
  page: PDFPage,
  fonts: Fonts,
  title: string,
  body: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  page.drawText(title, { x, y, size: 9, font: fonts.bold, color: FOREST });
  page.drawRectangle({
    x, y: y - h - 10, width: w, height: h,
    borderColor: RULE, borderWidth: 0.7,
  });
  if (body) {
    drawParagraph(page, body, {
      x: x + 9, y: y - 26, font: fonts.regular, size: 8,
      color: INK, maxWidth: w - 18, lineGap: 10.5,
    });
  }
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  studio: StudioProfile,
  opts?: { decorated?: boolean }
): void {
  if (opts?.decorated !== false) {
    drawBottomCurves(page);
    drawDotGrid(page, PAGE_W - MARGIN - 66, MARGIN + 6);
  }
  page.drawText("Capturer vos emotions, sublimer vos souvenirs.", {
    x: MARGIN + 8, y: FOOTER_BASELINE_Y, size: 10.5,
    font: fonts.italic, color: WHITE, opacity: 0.95,
  });
  const tva =
    studio.vat_status === "yes" && studio.vat_number
      ? "TVA " + studio.vat_number
      : "TVA non applicable, article 293 B du CGI.";
  centerText(page, tva, PAGE_W / 2, FOOTER_TVA_Y, 7, fonts.regular, MUTED);
  centerText(
    page,
    studio.company_legal_name + " - SIRET : " + studio.company_siret,
    PAGE_W / 2, FOOTER_SIRET_Y, 7, fonts.regular, MUTED
  );
}

// Ouvre une nouvelle page si la zone totaux+blocs ne tient pas sous le
// tableau. Retourne { page, y } pret a dessiner la section basse.
function ensureBottomRoom(
  pdf: PDFDocument,
  page: PDFPage,
  y: number
): { page: PDFPage; y: number } {
  if (y - BOTTOM_SECTION_H < MARGIN + 74) {
    const np = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
    drawTopRightCurve(np);
    return { page: np, y: PAGE_H - MARGIN - 40 };
  }
  return { page, y };
}

// ─── DEVIS ───────────────────────────────────────────────────────────
export async function buildQuotePdf(rawInput: {
  studio: StudioProfile;
  doc: QuoteDoc;
}): Promise<Uint8Array> {
  const input = sanitizeDeep(rawInput);
  const pdf = await PDFDocument.create();
  let page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
  const fonts = await loadFonts(pdf);
  const hero = await fetchHeroImage();
  await drawHeroPhoto(pdf, page, hero);

  let y = drawDocHeader(page, fonts, input.studio, {
    title: "DEVIS",
    reference: input.doc.reference,
    date: input.doc.issue_date,
    weddingDate: input.doc.wedding.date,
  });
  y = drawClientBlock(page, fonts, input.doc.client, y);

  const vatApplicable = input.studio.vat_status === "yes";
  const vatRate = Number(input.studio.vat_rate) || 20;
  const t = drawLinesTable(pdf, page, fonts, input.doc.lines, y, vatRate, vatApplicable);
  page = t.page;

  const room = ensureBottomRoom(pdf, page, t.y);
  page = room.page;
  y = room.y - 14;

  if (vatApplicable) {
    y = drawTotalBar(page, fonts, "SOUS-TOTAL HT", t.subtotal, y, { muted: true });
    y = drawTotalBar(page, fonts, "TVA " + vatRate + "%", t.vat, y, { muted: true });
  }
  y = drawTotalBar(page, fonts, "MONTANT TOTAL TTC", t.total, y);

  const halfW = CONTENT_W * 0.42;
  const blocksY = y - 26;
  if (input.doc.deposit_pct) {
    const deposit = Math.round((t.total * input.doc.deposit_pct) / 100);
    drawDepositBox(page, fonts, input.doc.deposit_pct, deposit, MARGIN + 26, blocksY, halfW);
  }
  drawSignatureBox(page, fonts, PAGE_W - MARGIN - halfW - 4, blocksY - 6, halfW);

  const validity = input.doc.validity_days ?? 60;
  page.drawText("Devis valable " + validity + " jours a compter de sa date d'emission.", {
    x: MARGIN, y: LEGAL_NOTE_Y + 14, size: 7.5, font: fonts.italic, color: MUTED,
  });

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}

// ─── FACTURE ─────────────────────────────────────────────────────────
export async function buildInvoicePdf(rawInput: {
  studio: StudioProfile;
  doc: InvoiceDoc;
}): Promise<Uint8Array> {
  const input = sanitizeDeep(rawInput);
  const pdf = await PDFDocument.create();
  let page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
  const fonts = await loadFonts(pdf);
  const hero = await fetchHeroImage();
  await drawHeroPhoto(pdf, page, hero);

  let y = drawDocHeader(page, fonts, input.studio, {
    title: "FACTURE",
    reference: input.doc.reference,
    date: input.doc.issue_date,
    weddingDate: input.doc.wedding.date,
    dueDate: input.doc.due_date,
  });
  y = drawClientBlock(page, fonts, input.doc.client, y);

  const vatApplicable = input.studio.vat_status === "yes";
  const vatRate = Number(input.studio.vat_rate) || 20;
  const t = drawLinesTable(pdf, page, fonts, input.doc.lines, y, vatRate, vatApplicable);
  page = t.page;

  const room = ensureBottomRoom(pdf, page, t.y);
  page = room.page;
  y = room.y - 14;

  y = drawTotalBar(
    page, fonts,
    vatApplicable ? "SOUS-TOTAL HT" : "SOUS-TOTAL TTC",
    t.subtotal, y, { muted: true }
  );
  if (vatApplicable) {
    y = drawTotalBar(page, fonts, "TVA " + vatRate + "%", t.vat, y, { muted: true });
  }
  const paid = input.doc.already_paid_cents ?? 0;
  if (paid > 0) {
    y = drawTotalBar(page, fonts, "ACOMPTE DEJA VERSE", paid, y, { muted: true });
  }
  y = drawTotalBar(page, fonts, "MONTANT A PAYER", Math.max(0, t.total - paid), y);

  const colW = CONTENT_W * 0.42;
  const rightX = PAGE_W - MARGIN - colW - 4;
  const blocksY = y - 22;

  drawLabeledBox(
    page, fonts, "CONDITIONS DE PAIEMENT",
    input.doc.payment_terms || "Paiement a reception, par virement bancaire.",
    MARGIN, blocksY, colW, 40
  );
  drawLabeledBox(
    page, fonts, "COORDONNEES BANCAIRES",
    input.studio.company_iban ? "IBAN : " + input.studio.company_iban : "(a communiquer)",
    MARGIN, blocksY - 66, colW, 40
  );
  drawSignatureBox(page, fonts, rightX, blocksY - 6, colW);

  page.drawText(
    "En cas de retard de paiement : penalite de 3x le taux d'interet legal + indemnite forfaitaire de 40 EUR (art. L441-10 C. com.).",
    { x: MARGIN, y: LEGAL_NOTE_Y, size: 6.5, font: fonts.italic, color: MUTED }
  );

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}

`;

s = s.slice(0, start) + block + s.slice(end);
fs.writeFileSync(p, s);
console.log("paginated PDF written");
