// ──────────────────────────────────────────────────────────────────────
// PDF generator — devis, contrats, factures (pdf-lib pure JS)
// ──────────────────────────────────────────────────────────────────────
//
// Design aligné sur la charte Romero Photography :
//   - Palette vert sauge (#8FA98A) + vert forêt profond (#4A6B4A)
//   - Courbes décoratives en haut-droite et bas-gauche
//   - Tableau à en-tête sauge plein, bordures fines
//   - Bloc acompte encadré + zone signature
//   - Trame de points décorative en bas-droite
//   - Footer signature « Capturer vos émotions, sublimer vos souvenirs »
//
// Contrainte technique : polices standard Helvetica (WinAnsi). Tout
// texte passe par sanitizeForPdf via le monkey-patch wrapPage.

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

// ─── Sanitize WinAnsi ────────────────────────────────────────────────
const WINANSI_REPLACE: Array<[RegExp, string]> = [
  [/[\u2009\u200A\u202F\u205F\u3000]/g, " "],
  [/[\u2028\u2029]/g, "\n"],
  [/[\uFEFF\u200B\u200C\u200D]/g, ""],
  [/\u2192/g, "->"],
  [/\u2190/g, "<-"],
  [/\u2194/g, "<->"],
  [/[\u2500-\u257F]/g, "-"],
  [/\u2212/g, "-"],
];
export function sanitizeForPdf(s: string): string {
  let out = s;
  for (const [re, rep] of WINANSI_REPLACE) out = out.replace(re, rep);
  return out;
}
function wrapPage(page: PDFPage): PDFPage {
  const original = page.drawText.bind(page);
  page.drawText = (text: string, options?: unknown) =>
    original(sanitizeForPdf(String(text ?? "")), options as never);
  return page;
}
function sanitizeDeep<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return sanitizeForPdf(input) as unknown as T;
  if (Array.isArray(input)) return input.map((v) => sanitizeDeep(v)) as unknown as T;
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as unknown as T;
  }
  return input;
}

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
  unit_price_cents: number;
};

export type QuoteDoc = {
  reference: string;
  issue_date: string;
  validity_days?: number;
  client: Client;
  wedding: {
    date?: string;
    location?: string;
    guest_count?: number;
    formula_name?: string;
  };
  lines: DocumentLine[];
  deposit_pct?: number;
  notes?: string;
};

export type InvoiceDoc = QuoteDoc & {
  due_date?: string;
  payment_terms?: string;
  already_paid_cents?: number;
};

export type ContractDoc = {
  reference: string;
  issue_date: string;
  client: Client & {
    postal_city?: string;
  };
  wedding: {
    date: string;
    location: string;
    guest_count?: number;
    ceremony_time?: string;
    end_time?: string;
    /** Lieu des préparatifs (mariés) */
    prep_location?: string;
    /** Lieu de la cérémonie */
    ceremony_location?: string;
    /** Lieu de réception */
    reception_location?: string;
  };
  formula_name: string;
  formula_description: string;
  /** Options souscrites (second shooter, album, agrandissements…) */
  options?: string;
  price_cents: number;
  deposit_pct: number;
  cancellation_policy?: string;
  image_rights?: string;
  force_majeure?: string;
  jurisdiction?: string;
};

// ─── Palette & layout ────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;

const SAGE = rgb(0.561, 0.663, 0.541);       // #8FA98A — bandeaux, courbes
const SAGE_LIGHT = rgb(0.855, 0.890, 0.843); // #DAE3D7 — fonds doux
const FOREST = rgb(0.290, 0.420, 0.290);     // #4A6B4A — titres
const INK = rgb(0.16, 0.16, 0.15);
const MUTED = rgb(0.45, 0.45, 0.42);
const RULE = rgb(0.82, 0.84, 0.80);
const WHITE = rgb(1, 1, 1);

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

async function loadFonts(pdf: PDFDocument): Promise<Fonts> {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
}

// ─── Helpers texte ───────────────────────────────────────────────────
function formatCents(cents: number): string {
  return sanitizeForPdf(
    (cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return sanitizeForPdf(
      new Date(iso).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    );
  } catch {
    return iso;
  }
}

function formatDateUpper(iso: string): string {
  return formatDate(iso).toUpperCase();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizeForPdf(text).split(/\s+/);
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
      page.drawText(wrapped, { x: opts.x, y, size: opts.size, font: opts.font, color });
      y -= lineGap;
    }
  }
  return y;
}

function rightAlign(page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color = INK) {
  const w = font.widthOfTextAtSize(sanitizeForPdf(text), size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

function centerText(page: PDFPage, text: string, centerX: number, y: number, size: number, font: PDFFont, color = INK) {
  const w = font.widthOfTextAtSize(sanitizeForPdf(text), size);
  page.drawText(text, { x: centerX - w / 2, y, size, font, color });
}

// ─── Décors : courbes, points ────────────────────────────────────────
/** Arc décoratif en haut-droite (deux couches sauge). */
function drawTopRightCurve(page: PDFPage) {
  // Grande courbe sauge clair
  page.drawSvgPath(
    "M 400 0 C 470 0 520 60 540 130 C 560 200 555 260 595 300 L 595 0 Z",
    {
      x: 0,
      y: PAGE_H,
      color: SAGE_LIGHT,
      opacity: 0.55,
    }
  );
  // Courbe sauge plus soutenue, décalée
  page.drawSvgPath(
    "M 470 0 C 525 5 560 65 575 125 C 585 165 588 195 595 220 L 595 0 Z",
    {
      x: 0,
      y: PAGE_H,
      color: SAGE,
      opacity: 0.75,
    }
  );
  // Fine ligne courbe blanche pour l'effet séparation
  page.drawSvgPath("M 455 8 C 515 20 552 80 568 140", {
    x: 0,
    y: PAGE_H,
    borderColor: WHITE,
    borderWidth: 1.2,
    opacity: 0.9,
  });
}

/** Vagues décoratives en bas-gauche (deux couches sauge). */
function drawBottomLeftCurve(page: PDFPage) {
  page.drawSvgPath(
    "M 0 0 C 60 -35 150 -55 240 -40 C 320 -28 380 -5 430 5 L 0 5 Z",
    {
      x: 0,
      y: 118,
      color: SAGE_LIGHT,
      opacity: 0.6,
    }
  );
  page.drawSvgPath(
    "M 0 0 C 55 -28 140 -45 225 -32 C 290 -22 340 -6 380 2 L 0 2 Z",
    {
      x: 0,
      y: 82,
      color: SAGE,
      opacity: 0.85,
    }
  );
}

/** Trame de points décorative (coin bas-droite). */
function drawDotGrid(page: PDFPage, x: number, y: number, cols = 11, rows = 9, gap = 5.4) {
  for (let r = 0; r < rows; r++) {
    // Triangle : chaque rangée est plus courte en montant
    const count = Math.max(1, cols - r);
    for (let c = 0; c < count; c++) {
      page.drawCircle({
        x: x + c * gap,
        y: y + r * gap,
        size: 0.85,
        color: INK,
        opacity: 0.55,
      });
    }
  }
}

/** Logo « Oo » stylisé (deux cercles concentriques + cercle plein). */
function drawLogo(page: PDFPage, x: number, y: number, scale = 1) {
  const r1 = 15 * scale;
  const r2 = 9 * scale;
  // Halo sauge derrière le grand cercle
  page.drawCircle({ x: x + r1 * 0.55, y: y - r1 * 0.15, size: r1 * 0.85, color: SAGE, opacity: 0.35 });
  // Grand anneau
  page.drawCircle({ x, y, size: r1, borderColor: INK, borderWidth: 2.4 * scale });
  // Petit anneau à droite
  page.drawCircle({ x: x + r1 + r2 * 0.85, y: y - r1 * 0.18, size: r2, borderColor: INK, borderWidth: 2.2 * scale });
}

// ─── Photo de fond (hero du site) ────────────────────────────────────
// Récupère l'image hero configurée en admin (page_content.hero_photo) et
// l'embarque dans le PDF. Cache en mémoire pour ne pas re-télécharger à
// chaque génération. Best-effort : si le fetch échoue, le PDF sort sans
// photo (le layout reste valide).
let heroCache: { bytes: Uint8Array; type: "jpg" | "png" } | null | undefined;

/** Injection directe du cache — utilisé par les scripts de test locaux
 *  qui n'ont pas accès à la DB. Ne pas appeler en production. */
export function __setHeroCacheForTest(
  v: { bytes: Uint8Array; type: "jpg" | "png" } | null
): void {
  heroCache = v;
}

export async function fetchHeroImage(): Promise<
  { bytes: Uint8Array; type: "jpg" | "png" } | null
> {
  if (heroCache !== undefined) return heroCache;
  try {
    const { queryOne } = await import("@/lib/db");
    const row = await queryOne<{ value: string }>(
      `SELECT value FROM page_content WHERE page = 'home' AND key = 'hero_photo' LIMIT 1`
    );
    const url = row?.value?.trim();
    if (!url) {
      heroCache = null;
      return null;
    }
    const resp = await fetch(url);
    if (!resp.ok) {
      heroCache = null;
      return null;
    }
    const buf = new Uint8Array(await resp.arrayBuffer());
    // Détection du format par magic bytes
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    heroCache = { bytes: buf, type: isPng ? "png" : "jpg" };
    return heroCache;
  } catch {
    heroCache = null;
    return null;
  }
}

/**
 * Dessine la photo hero dans la zone header, avec un dégradé blanc par
 * dessus pour garder le texte lisible.
 */
async function drawHeroPhoto(
  pdf: PDFDocument,
  page: PDFPage,
  hero: { bytes: Uint8Array; type: "jpg" | "png" } | null
): Promise<void> {
  if (!hero) return;
  try {
    const img =
      hero.type === "png"
        ? await pdf.embedPng(hero.bytes)
        : await pdf.embedJpg(hero.bytes);

    // Zone photo : bande horizontale en haut, largeur pleine page
    const zoneH = 210;
    const zoneY = PAGE_H - zoneH;
    const scale = Math.max(PAGE_W / img.width, zoneH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    // Cadrage : centré horizontalement, aligné sur le haut du sujet
    const drawX = (PAGE_W - drawW) / 2;
    const drawY = zoneY - (drawH - zoneH) * 0.42;

    page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH, opacity: 0.42 });

    // Voile blanc dégradé simulé par bandes successives (pdf-lib n'a pas
    // de vrai gradient) — dense à gauche (texte) et en bas (tableau).
    const bands = 26;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      page.drawRectangle({
        x: 0,
        y: zoneY + (zoneH / bands) * i,
        width: PAGE_W * 0.52,
        height: zoneH / bands + 1,
        color: WHITE,
        opacity: 0.42 + 0.3 * (1 - t),
      });
    }
    // Fondu vers le bas (transition vers le corps blanc)
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      page.drawRectangle({
        x: 0,
        y: zoneY + (zoneH / bands) * i,
        width: PAGE_W,
        height: zoneH / bands + 1,
        color: WHITE,
        opacity: 0.75 * (1 - t) * (1 - t),
      });
    }
  } catch {
    // embed échoué (format exotique) — on continue sans photo
  }
}

// ─── En-tête commun (devis / facture) ────────────────────────────────
function drawDocHeader(
  page: PDFPage,
  fonts: Fonts,
  studio: StudioProfile,
  doc: {
    title: string;         // « DEVIS » ou « FACTURE »
    reference: string;
    date: string;
    weddingDate?: string;
    dueDate?: string;
  }
): number {
  drawTopRightCurve(page);

  // ── Colonne gauche : logo + identité ──
  const topY = PAGE_H - MARGIN;
  drawLogo(page, MARGIN + 16, topY - 22, 1);

  // Nom de marque en script-like (Helvetica italique, letter-spaced)
  page.drawText("Romero Photography", {
    x: MARGIN,
    y: topY - 58,
    size: 15,
    font: fonts.italic,
    color: rgb(0.42, 0.48, 0.42),
  });

  let y = topY - 84;
  page.drawText(studio.company_legal_name, {
    x: MARGIN, y, size: 10, font: fonts.bold, color: INK,
  });
  y -= 13;
  page.drawText("Photographe de mariage", {
    x: MARGIN, y, size: 9.5, font: fonts.bold, color: INK,
  });
  y -= 13;
  page.drawText("Nice, Cote d'Azur & France", {
    x: MARGIN, y, size: 9.5, font: fonts.bold, color: INK,
  });

  // Coordonnées avec pictos simples
  y -= 24;
  const iconX = MARGIN + 3;
  const textX = MARGIN + 20;

  // Globe
  page.drawCircle({ x: iconX + 3, y: y + 3, size: 5, borderColor: SAGE, borderWidth: 1 });
  page.drawText("romerophotography.fr", { x: textX, y, size: 9, font: fonts.regular, color: INK });
  y -= 17;

  // Téléphone
  page.drawCircle({ x: iconX + 3, y: y + 3, size: 5, borderColor: SAGE, borderWidth: 1 });
  page.drawText(studio.company_phone, { x: textX, y, size: 9, font: fonts.regular, color: INK });
  y -= 17;

  // Enveloppe
  page.drawRectangle({ x: iconX - 1, y: y - 0.5, width: 9, height: 6.5, borderColor: SAGE, borderWidth: 1 });
  page.drawText(studio.company_email, { x: textX, y, size: 9, font: fonts.regular, color: INK });

  // ── Colonne droite : titre + numéro + dates ──
  const rightEdge = PAGE_W - MARGIN;

  // Date d'émission au-dessus du gros titre
  rightAlign(page, formatDateUpper(doc.date), rightEdge, topY - 18, 8.5, fonts.bold, FOREST);

  // Gros titre
  rightAlign(page, doc.title, rightEdge, topY - 52, 30, fonts.bold, FOREST);

  // Numéro
  rightAlign(page, `N° ${doc.reference}`, rightEdge, topY - 76, 13, fonts.regular, INK);

  // Ligne de séparation sous le numéro
  page.drawLine({
    start: { x: rightEdge - 145, y: topY - 90 },
    end: { x: rightEdge, y: topY - 90 },
    thickness: 0.7,
    color: SAGE,
  });

  // Bloc date mariage / échéance
  let rightY = topY - 108;
  if (doc.weddingDate) {
    rightAlign(page, "MARIAGE", rightEdge, rightY, 8.5, fonts.bold, FOREST);
    rightY -= 15;
    rightAlign(page, formatDateUpper(doc.weddingDate), rightEdge, rightY, 10.5, fonts.regular, INK);
    rightY -= 22;
  }
  if (doc.dueDate) {
    rightAlign(page, "DATE D'ECHEANCE", rightEdge, rightY, 8.5, fonts.bold, FOREST);
    rightY -= 15;
    rightAlign(page, formatDateUpper(doc.dueDate), rightEdge, rightY, 10.5, fonts.regular, INK);
    rightY -= 22;
  }

  return Math.min(y, rightY) - 24;
}

// ─── Bloc client ─────────────────────────────────────────────────────
function drawClientBlock(page: PDFPage, fonts: Fonts, client: Client, y: number, label = "CLIENTS"): number {
  page.drawText(label, { x: MARGIN, y, size: 9, font: fonts.bold, color: FOREST });
  y -= 16;
  page.drawText(client.name, { x: MARGIN, y, size: 9.5, font: fonts.regular, color: INK });
  y -= 13;
  if (client.address) {
    y = drawParagraph(page, client.address, {
      x: MARGIN, y, font: fonts.regular, size: 9.5, color: INK, maxWidth: 250, lineGap: 13,
    });
  }
  if (client.phone) {
    page.drawText(client.phone, { x: MARGIN, y, size: 9.5, font: fonts.regular, color: INK });
    y -= 13;
  }
  if (client.email) {
    page.drawText(client.email, { x: MARGIN, y, size: 9.5, font: fonts.regular, color: INK });
    y -= 13;
  }
  return y - 12;
}

// ─── Tableau des lignes ──────────────────────────────────────────────
type TableResult = { y: number; subtotal: number; vat: number; total: number };

function drawLinesTable(
  page: PDFPage,
  fonts: Fonts,
  lines: DocumentLine[],
  startY: number,
  vatRatePct: number,
  vatApplicable: boolean
): TableResult {
  const tableX = MARGIN;
  const tableW = PAGE_W - 2 * MARGIN;

  // Colonnes : Désignation | Détail | Qté | PU TTC | Total TTC
  const cols = [
    { w: 0.215, label: "DESIGNATION", align: "center" as const },
    { w: 0.325, label: "DETAIL", align: "center" as const },
    { w: 0.115, label: "QUANTITE", align: "center" as const },
    { w: 0.17, label: "PRIX UNIT. TTC", align: "center" as const },
    { w: 0.175, label: "TOTAL TTC", align: "center" as const },
  ];
  const colX: number[] = [];
  let acc = tableX;
  for (const c of cols) {
    colX.push(acc);
    acc += c.w * tableW;
  }
  colX.push(tableX + tableW);

  // ── En-tête sauge plein ──
  const headH = 26;
  let y = startY;
  page.drawRectangle({ x: tableX, y: y - headH, width: tableW, height: headH, color: SAGE });
  cols.forEach((c, i) => {
    const cx = (colX[i] + colX[i + 1]) / 2;
    centerText(page, c.label, cx, y - headH + 9, 8, fonts.bold, WHITE);
  });
  y -= headH;

  // ── Lignes ──
  let subtotal = 0;
  const bodyTop = y;

  for (const line of lines) {
    const lineTotal = line.quantity * line.unit_price_cents;
    subtotal += lineTotal;

    // Mesure la hauteur nécessaire
    const labelLines = wrapText(line.label, fonts.bold, 9, cols[0].w * tableW - 16);
    const detailBullets = (line.detail || "")
      .split("\n")
      .map((s) => s.replace(/^[-*·•]\s*/, "").trim())
      .filter(Boolean);
    let detailLineCount = 0;
    const wrappedDetails: string[][] = [];
    for (const b of detailBullets) {
      const w = wrapText(b, fonts.regular, 8.5, cols[1].w * tableW - 26);
      wrappedDetails.push(w);
      detailLineCount += w.length;
    }
    const contentH = Math.max(
      labelLines.length * 12 + 16,
      detailLineCount * 11.5 + 16,
      36
    );

    // Bordures de la ligne
    page.drawRectangle({
      x: tableX, y: y - contentH, width: tableW, height: contentH,
      borderColor: RULE, borderWidth: 0.6,
    });
    // Séparateurs verticaux
    for (let i = 1; i < colX.length - 1; i++) {
      page.drawLine({
        start: { x: colX[i], y }, end: { x: colX[i], y: y - contentH },
        thickness: 0.6, color: RULE,
      });
    }

    // Désignation (verticalement centrée)
    let ly = y - contentH / 2 + (labelLines.length * 12) / 2 - 8;
    for (const l of labelLines) {
      page.drawText(l, { x: colX[0] + 8, y: ly, size: 9, font: fonts.bold, color: INK });
      ly -= 12;
    }

    // Détail (puces)
    let dy = y - 14;
    for (const bulletLines of wrappedDetails) {
      page.drawCircle({ x: colX[1] + 10, y: dy + 3, size: 1.3, color: INK });
      bulletLines.forEach((bl, idx) => {
        page.drawText(bl, {
          x: colX[1] + 17,
          y: dy,
          size: 8.5,
          font: fonts.regular,
          color: INK,
        });
        dy -= 11.5;
        if (idx < bulletLines.length - 1) {
          // lignes suivantes du même bullet : pas de puce
        }
      });
    }

    // Quantité, PU, Total (centrés verticalement)
    const midY = y - contentH / 2 - 3;
    centerText(page, String(line.quantity), (colX[2] + colX[3]) / 2, midY, 9, fonts.regular, INK);
    centerText(page, `${formatCents(line.unit_price_cents)} EUR`, (colX[3] + colX[4]) / 2, midY, 9, fonts.regular, INK);
    centerText(page, `${formatCents(lineTotal)} EUR`, (colX[4] + colX[5]) / 2, midY, 9, fonts.regular, INK);

    y -= contentH;
  }

  const vat = vatApplicable ? Math.round(subtotal * (vatRatePct / 100)) : 0;
  const total = subtotal + vat;

  return { y, subtotal, vat, total };
}

/** Bandeau total TTC aligné à droite. */
function drawTotalBar(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  amountCents: number,
  y: number,
  opts?: { muted?: boolean }
): number {
  const barH = 24;
  const barW = (PAGE_W - 2 * MARGIN) * 0.585;
  const barX = PAGE_W - MARGIN - barW;
  const valueW = barW * 0.32;

  page.drawRectangle({
    x: barX, y: y - barH, width: barW - valueW, height: barH,
    color: opts?.muted ? SAGE_LIGHT : SAGE,
  });
  page.drawRectangle({
    x: barX + barW - valueW, y: y - barH, width: valueW, height: barH,
    borderColor: RULE, borderWidth: 0.6,
  });

  page.drawText(label, {
    x: barX + 12, y: y - barH + 8, size: 9,
    font: fonts.bold, color: opts?.muted ? FOREST : WHITE,
  });
  rightAlign(page, `${formatCents(amountCents)} EUR`, PAGE_W - MARGIN - 10, y - barH + 8, 10, fonts.bold, INK);

  return y - barH - 8;
}

// ─── Bloc acompte (encadré arrondi + cœur) ───────────────────────────
function drawDepositBox(
  page: PDFPage,
  fonts: Fonts,
  pct: number,
  amountCents: number,
  x: number,
  y: number,
  w: number
): void {
  const h = 78;
  page.drawRectangle({
    x, y: y - h, width: w, height: h,
    borderColor: RULE, borderWidth: 0.8,
  });
  // Cœur stylisé en haut (deux cercles + triangle)
  const hx = x + w / 2;
  const hy = y - 2;
  page.drawCircle({ x: hx, y: hy, size: 9, color: WHITE, borderColor: RULE, borderWidth: 0.8 });
  page.drawSvgPath("M 0 0 C -2.4 -2.6 -5 -0.9 -5 1.4 C -5 3.6 -2.6 5.2 0 7.4 C 2.6 5.2 5 3.6 5 1.4 C 5 -0.9 2.4 -2.6 0 0 Z", {
    x: hx,
    y: hy + 3,
    borderColor: SAGE,
    borderWidth: 1,
  });

  centerText(page, "ACOMPTE A LA RESERVATION", hx, y - 26, 8, fonts.regular, MUTED);
  centerText(page, `${pct}%`, hx, y - 50, 20, fonts.bold, INK);
  centerText(page, `soit ${formatCents(amountCents)} EUR`, hx, y - 66, 9, fonts.regular, MUTED);
}

// ─── Zone signature ──────────────────────────────────────────────────
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
    x, y: y - 62, width: w, height: 42,
    borderColor: FOREST, borderWidth: 0.8,
  });
}

// ─── Pied de page ────────────────────────────────────────────────────
function drawFooter(page: PDFPage, fonts: Fonts, studio: StudioProfile, opts?: { decorated?: boolean }) {
  if (opts?.decorated !== false) {
    drawBottomLeftCurve(page);
    drawDotGrid(page, PAGE_W - MARGIN - 58, MARGIN + 4);
  }

  // Baseline signature à gauche, sur la courbe
  page.drawText("Capturer vos emotions, sublimer vos souvenirs.", {
    x: MARGIN + 6,
    y: MARGIN + 22,
    size: 10.5,
    font: fonts.italic,
    color: WHITE,
    opacity: 0.92,
  });

  // Mentions légales centrées
  const tva =
    studio.vat_status === "yes" && studio.vat_number
      ? `TVA ${studio.vat_number}`
      : "TVA non applicable, article 293 B du CGI.";
  centerText(page, tva, PAGE_W / 2, MARGIN + 8, 7, fonts.regular, MUTED);
  centerText(
    page,
    `${studio.company_legal_name} - SIRET : ${studio.company_siret}`,
    PAGE_W / 2,
    MARGIN - 2,
    7,
    fonts.regular,
    MUTED
  );
}

// ─── DEVIS ───────────────────────────────────────────────────────────
export async function buildQuotePdf(rawInput: {
  studio: StudioProfile;
  doc: QuoteDoc;
}): Promise<Uint8Array> {
  const input = sanitizeDeep(rawInput);
  const pdf = await PDFDocument.create();
  const page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
  const fonts = await loadFonts(pdf);
  await drawHeroPhoto(pdf, page, await fetchHeroImage());

  let y = drawDocHeader(page, fonts, input.studio, {
    title: "DEVIS",
    reference: input.doc.reference,
    date: input.doc.issue_date,
    weddingDate: input.doc.wedding.date,
  });

  y = drawClientBlock(page, fonts, input.doc.client, y);

  const vatApplicable = input.studio.vat_status === "yes";
  const vatRate = Number(input.studio.vat_rate) || 20;
  const totals = drawLinesTable(page, fonts, input.doc.lines, y, vatRate, vatApplicable);
  y = totals.y - 12;

  // Sous-total si TVA applicable
  if (vatApplicable) {
    y = drawTotalBar(page, fonts, "SOUS-TOTAL HT", totals.subtotal, y, { muted: true });
    y = drawTotalBar(page, fonts, `TVA ${vatRate}%`, totals.vat, y, { muted: true });
  }
  y = drawTotalBar(page, fonts, "MONTANT TOTAL TTC", totals.total, y);
  y -= 14;

  // Bloc acompte (gauche) + signature (droite)
  const halfW = (PAGE_W - 2 * MARGIN) * 0.44;
  const rightX = PAGE_W - MARGIN - halfW - 10;
  if (input.doc.deposit_pct) {
    const deposit = Math.round((totals.total * input.doc.deposit_pct) / 100);
    drawDepositBox(page, fonts, input.doc.deposit_pct, deposit, MARGIN + 20, y, halfW);
  }
  drawSignatureBox(page, fonts, rightX, y - 8, halfW - 10);
  y -= 92;

  // Validité + notes
  const validity = input.doc.validity_days ?? 60;
  page.drawText(`Devis valable ${validity} jours a compter de sa date d'emission.`, {
    x: MARGIN, y, size: 8, font: fonts.italic, color: MUTED,
  });
  y -= 14;

  if (input.doc.notes) {
    y = drawParagraph(page, input.doc.notes, {
      x: MARGIN, y, font: fonts.regular, size: 8, color: MUTED,
      maxWidth: PAGE_W - 2 * MARGIN, lineGap: 11,
    });
  }

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
  const page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
  const fonts = await loadFonts(pdf);
  await drawHeroPhoto(pdf, page, await fetchHeroImage());

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
  const totals = drawLinesTable(page, fonts, input.doc.lines, y, vatRate, vatApplicable);
  y = totals.y - 12;

  // Blocs de totaux empilés
  y = drawTotalBar(page, fonts, vatApplicable ? "SOUS-TOTAL HT" : "SOUS-TOTAL TTC", totals.subtotal, y, { muted: true });
  if (vatApplicable) {
    y = drawTotalBar(page, fonts, `TVA ${vatRate}%`, totals.vat, y, { muted: true });
  }
  y = drawTotalBar(page, fonts, "TOTAL TTC", totals.total, y, { muted: true });

  const paid = input.doc.already_paid_cents ?? 0;
  if (paid > 0) {
    y = drawTotalBar(page, fonts, "ACOMPTE DEJA VERSE", paid, y, { muted: true });
  }
  const remaining = Math.max(0, totals.total - paid);
  y = drawTotalBar(page, fonts, "MONTANT A PAYER", remaining, y);
  y -= 16;

  // Colonne gauche : conditions + IBAN | Colonne droite : signature
  const colW = (PAGE_W - 2 * MARGIN) * 0.44;
  const rightX = PAGE_W - MARGIN - colW - 10;
  const leftTop = y;

  page.drawText("CONDITIONS DE PAIEMENT", { x: MARGIN, y: leftTop, size: 9, font: fonts.bold, color: FOREST });
  page.drawRectangle({
    x: MARGIN, y: leftTop - 48, width: colW, height: 40,
    borderColor: RULE, borderWidth: 0.7,
  });
  if (input.doc.payment_terms) {
    drawParagraph(page, input.doc.payment_terms, {
      x: MARGIN + 8, y: leftTop - 22, font: fonts.regular, size: 8,
      color: INK, maxWidth: colW - 16, lineGap: 10,
    });
  }

  page.drawText("COORDONNEES BANCAIRES", { x: MARGIN, y: leftTop - 62, size: 9, font: fonts.bold, color: FOREST });
  page.drawRectangle({
    x: MARGIN, y: leftTop - 110, width: colW, height: 40,
    borderColor: RULE, borderWidth: 0.7,
  });
  if (input.studio.company_iban) {
    drawParagraph(page, `IBAN : ${input.studio.company_iban}`, {
      x: MARGIN + 8, y: leftTop - 84, font: fonts.regular, size: 8,
      color: INK, maxWidth: colW - 16, lineGap: 10,
    });
  }

  drawSignatureBox(page, fonts, rightX, leftTop - 62, colW - 10);

  // Mention légale retard
  page.drawText(
    "En cas de retard de paiement : penalite de 3x le taux d'interet legal + indemnite forfaitaire de 40 EUR (art. L441-10 C. com.).",
    { x: MARGIN, y: MARGIN + 44, size: 6.5, font: fonts.italic, color: MUTED }
  );

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}

// ─── CONTRAT ─────────────────────────────────────────────────────────
// Structure alignée sur le contrat de référence Romero Photography :
//   En-tête + Entre les soussignés + Le Photographe + Les Clients
//   + Informations mariage + 9 articles + cases droit à l'image
//   + Fait à / Le / signatures.
// Les champs non renseignés apparaissent en pointillés à remplir main.

/** Ligne « Label : valeur » ou « Label : ______ » si vide. */
function drawFieldLine(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string | undefined,
  x: number,
  y: number,
  lineW = 200
): void {
  page.drawText(`${label} :`, { x, y, size: 9, font: fonts.regular, color: INK });
  const labelW = fonts.regular.widthOfTextAtSize(sanitizeForPdf(`${label} :`), 9);
  const vx = x + labelW + 6;
  if (value && value.trim()) {
    page.drawText(value.trim(), { x: vx, y, size: 9, font: fonts.bold, color: INK });
  } else {
    page.drawLine({
      start: { x: vx, y: y - 2 },
      end: { x: vx + lineW, y: y - 2 },
      thickness: 0.6,
      color: RULE,
    });
  }
}

/** Case à cocher carrée + libellé. */
function drawCheckbox(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  x: number,
  y: number,
  checked = false
): void {
  page.drawRectangle({
    x, y: y - 1, width: 9, height: 9,
    borderColor: FOREST, borderWidth: 0.8,
  });
  if (checked) {
    page.drawSvgPath("M 1.5 4.5 L 3.6 6.8 L 7.5 1.8", {
      x, y: y + 8, borderColor: FOREST, borderWidth: 1.3,
    });
  }
  page.drawText(label, { x: x + 16, y, size: 9, font: fonts.regular, color: INK });
}

export async function buildContractPdf(rawInput: {
  studio: StudioProfile;
  doc: ContractDoc;
}): Promise<Uint8Array> {
  const input = sanitizeDeep(rawInput);
  const d = input.doc;
  const st = input.studio;
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const hero = await fetchHeroImage();
  let page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
  await drawHeroPhoto(pdf, page, hero);
  drawTopRightCurve(page);

  const contentW = PAGE_W - 2 * MARGIN;

  // ── Titre principal ──
  drawLogo(page, MARGIN + 16, PAGE_H - MARGIN - 22, 0.85);
  centerText(page, "ROMERO PHOTOGRAPHY", PAGE_W / 2, PAGE_H - MARGIN - 62, 21, fonts.bold, FOREST);
  centerText(
    page,
    "Contrat de prestation photographique de mariage",
    PAGE_W / 2,
    PAGE_H - MARGIN - 84,
    11.5,
    fonts.regular,
    INK
  );
  page.drawLine({
    start: { x: PAGE_W / 2 - 70, y: PAGE_H - MARGIN - 96 },
    end: { x: PAGE_W / 2 + 70, y: PAGE_H - MARGIN - 96 },
    thickness: 1.2,
    color: SAGE,
  });

  // Référence + date (discret, en haut à droite)
  rightAlign(page, `N° ${d.reference}`, PAGE_W - MARGIN, PAGE_H - MARGIN - 14, 9, fonts.bold, FOREST);
  rightAlign(page, formatDate(d.issue_date), PAGE_W - MARGIN, PAGE_H - MARGIN - 26, 8.5, fonts.regular, MUTED);

  let y = PAGE_H - MARGIN - 124;

  const bottom = MARGIN + 76;
  const newPage = () => {
    drawFooter(page, fonts, st, { decorated: false });
    page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
    y = PAGE_H - MARGIN - 24;
  };
  const ensureRoom = (need: number) => {
    if (y - need < bottom) newPage();
  };

  // ── Entre les soussignés ──
  page.drawText("Entre les soussignes :", { x: MARGIN, y, size: 10, font: fonts.italic, color: INK });
  y -= 26;

  // ── Bloc Le Photographe ──
  page.drawText("Le Photographe", { x: MARGIN, y, size: 12, font: fonts.bold, color: FOREST });
  page.drawLine({
    start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + 40, y: y - 5 },
    thickness: 1.3, color: SAGE,
  });
  y -= 20;
  const photographerLines = [
    `Romero Photography - ${st.company_legal_name}`,
    st.company_address,
    `Tel. : ${st.company_phone}`,
    "Site : https://romerophotography.fr",
    `E-mail : ${st.company_email}`,
    `SIRET : ${st.company_siret}`,
  ];
  for (const l of photographerLines) {
    y = drawParagraph(page, l, {
      x: MARGIN, y, font: fonts.regular, size: 9, color: INK, maxWidth: contentW, lineGap: 13,
    });
  }
  y -= 16;

  // ── Bloc Les Clients ──
  ensureRoom(120);
  page.drawText("Les Clients", { x: MARGIN, y, size: 12, font: fonts.bold, color: FOREST });
  page.drawLine({
    start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + 40, y: y - 5 },
    thickness: 1.3, color: SAGE,
  });
  y -= 22;
  drawFieldLine(page, fonts, "Nom & prenom", d.client.name, MARGIN, y, 230);
  y -= 17;
  drawFieldLine(page, fonts, "Adresse", d.client.address?.split("\n")[0], MARGIN, y, 250);
  y -= 17;
  drawFieldLine(
    page, fonts, "Code postal / Ville",
    d.client.postal_city ?? d.client.address?.split("\n").slice(1).join(" "),
    MARGIN, y, 210
  );
  y -= 17;
  drawFieldLine(page, fonts, "Telephone", d.client.phone, MARGIN, y, 220);
  y -= 17;
  drawFieldLine(page, fonts, "E-mail", d.client.email, MARGIN, y, 240);
  y -= 26;

  // ── Bloc Informations mariage ──
  ensureRoom(150);
  page.drawText("Informations concernant le mariage", { x: MARGIN, y, size: 12, font: fonts.bold, color: FOREST });
  page.drawLine({
    start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + 40, y: y - 5 },
    thickness: 1.3, color: SAGE,
  });
  y -= 22;
  drawFieldLine(page, fonts, "Date", d.wedding.date ? formatDate(d.wedding.date) : undefined, MARGIN, y, 180);
  y -= 17;
  drawFieldLine(page, fonts, "Lieu des preparatifs", d.wedding.prep_location, MARGIN, y, 200);
  y -= 17;
  drawFieldLine(page, fonts, "Lieu de la ceremonie", d.wedding.ceremony_location ?? d.wedding.location, MARGIN, y, 200);
  y -= 17;
  drawFieldLine(page, fonts, "Lieu de reception", d.wedding.reception_location, MARGIN, y, 210);
  y -= 17;
  drawFieldLine(
    page, fonts, "Nombre d'invites",
    d.wedding.guest_count ? String(d.wedding.guest_count) : undefined,
    MARGIN, y, 210
  );
  y -= 17;
  drawFieldLine(page, fonts, "Formule reservee", d.formula_name, MARGIN, y, 210);
  y -= 17;
  drawFieldLine(page, fonts, "Options", d.options, MARGIN, y, 240);
  y -= 30;

  // ── Articles ──
  const article = (num: number, title: string, body: string, minRoom = 70) => {
    ensureRoom(minRoom);
    page.drawText(`${num}. ${title}`, { x: MARGIN, y, size: 11.5, font: fonts.bold, color: FOREST });
    y -= 17;
    y = drawParagraph(page, body, {
      x: MARGIN, y, font: fonts.regular, size: 9.5, color: INK, maxWidth: contentW, lineGap: 13,
    });
    y -= 14;
  };

  article(
    1,
    "Objet",
    "Le present contrat definit les conditions de realisation de la prestation photographique de mariage."
  );

  const deposit = Math.round((d.price_cents * d.deposit_pct) / 100);
  const balance = d.price_cents - deposit;
  const vatApplicable = st.vat_status === "yes";
  article(
    2,
    "Conditions financieres",
    `Montant total : ${formatCents(d.price_cents)} EUR TTC - Acompte : ${formatCents(deposit)} EUR (${d.deposit_pct} %). ` +
      `Solde de ${formatCents(balance)} EUR a regler selon les conditions convenues.${
        vatApplicable ? "" : " TVA non applicable, article 293 B du CGI."
      }`
  );

  article(
    3,
    "Reservation",
    "La reservation est definitive a reception du contrat signe et de l'acompte."
  );

  article(
    4,
    "Obligations des clients",
    "Les clients s'engagent a communiquer toutes les informations utiles au bon deroulement de la prestation."
  );

  article(
    5,
    "Obligations du photographe",
    "Le photographe met tout en oeuvre pour realiser la prestation avec professionnalisme."
  );

  article(
    6,
    "Repas du photographe",
    "Si la formule comprend une presence pendant le repas (notamment les formules incluant l'ouverture de bal), les clients s'engagent a prevoir un repas complet pour le photographe."
  );

  article(
    7,
    "Livraison",
    "Les photographies seront livrees via une galerie privee en ligne."
  );

  article(
    8,
    "Droit d'auteur",
    "Le photographe conserve les droits d'auteur. Les clients disposent d'un droit d'usage prive."
  );

  // Article 9 : droit à l'image avec cases à cocher
  ensureRoom(80);
  page.drawText("9. Droit a l'image", { x: MARGIN, y, size: 11.5, font: fonts.bold, color: FOREST });
  y -= 20;
  drawCheckbox(page, fonts, "J'autorise Romero Photography a utiliser certaines photographies.", MARGIN, y);
  y -= 17;
  drawCheckbox(page, fonts, "Je refuse toute utilisation.", MARGIN, y);
  y -= 26;

  // Clauses additionnelles éventuelles
  if (d.cancellation_policy) {
    article(10, "Annulation", d.cancellation_policy);
  }
  if (st.contract_extra_clauses) {
    article(d.cancellation_policy ? 11 : 10, "Clauses additionnelles", st.contract_extra_clauses);
  }

  // ── Fait à / Le / Signatures ──
  ensureRoom(130);
  y -= 6;
  drawFieldLine(page, fonts, "Fait a", undefined, MARGIN, y, 130);
  drawFieldLine(page, fonts, "Le", undefined, MARGIN + 240, y, 130);
  y -= 34;

  page.drawText("Signature des Clients :", { x: MARGIN, y, size: 9.5, font: fonts.regular, color: INK });
  page.drawText('(precedee de la mention "Bon pour accord")', {
    x: MARGIN, y: y - 12, size: 7.5, font: fonts.italic, color: MUTED,
  });
  page.drawRectangle({
    x: MARGIN, y: y - 62, width: contentW * 0.44, height: 44,
    borderColor: FOREST, borderWidth: 0.8,
  });

  const rx = MARGIN + contentW * 0.52;
  page.drawText("Signature Romero Photography :", { x: rx, y, size: 9.5, font: fonts.regular, color: INK });
  page.drawRectangle({
    x: rx, y: y - 62, width: contentW * 0.44, height: 44,
    borderColor: FOREST, borderWidth: 0.8,
  });

  drawFooter(page, fonts, st);
  return pdf.save();
}
