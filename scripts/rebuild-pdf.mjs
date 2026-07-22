/**
 * Réécrit src/lib/pdf-generator.ts avec le layout définitif.
 * Passe par un script pour éviter que l'éditeur n'insère de vrais
 * caractères unicode invisibles dans les regex de sanitize.
 */
import fs from "node:fs";

const SRC = String.raw`// ──────────────────────────────────────────────────────────────────────
// PDF generator — devis, contrats, factures (pdf-lib pure JS)
// ──────────────────────────────────────────────────────────────────────
//
// Charte Romero Photography :
//   - Vert sauge #8FA98A (bandeaux, courbes) + forêt #4A6B4A (titres)
//   - Photo hero du site en bandeau haut, fondue latéralement pour que
//     le texte reste lisible à gauche et le titre à droite
//   - Courbes décoratives haut-droite / bas-gauche, trame de points
//   - Tableau 5 colonnes à en-tête sauge plein
//
// Layout : toutes les zones du bas sont ancrées en coordonnées absolues
// depuis le bas de page (FOOTER_*, BLOCKS_TOP). Le contenu du haut
// coule vers le bas mais ne peut jamais empiéter — le tableau est
// borné par TABLE_BOTTOM_LIMIT.

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";

// ─── Sanitize WinAnsi ────────────────────────────────────────────────
// Helvetica standard n'encode que WinAnsi (CP1252). Les typographies
// françaises (espace fine insécable U+202F que produit Intl, flèches,
// box-drawing) font crasher pdf-lib. On les remplace en amont.
const WINANSI_REPLACE = [
  [new RegExp("[    　]", "g"), " "],
  [new RegExp("[  ]", "g"), "\n"],
  [new RegExp("[﻿​‌‍]", "g"), ""],
  [new RegExp("→", "g"), "->"],
  [new RegExp("←", "g"), "<-"],
  [new RegExp("↔", "g"), "<->"],
  [new RegExp("[─-╿]", "g"), "-"],
  [new RegExp("−", "g"), "-"],
];

export function sanitizeForPdf(s) {
  let out = s;
  for (const [re, rep] of WINANSI_REPLACE) out = out.replace(re, rep);
  return out;
}

function wrapPage(page) {
  const original = page.drawText.bind(page);
  page.drawText = (text, options) =>
    original(sanitizeForPdf(String(text ?? "")), options);
  return page;
}

function sanitizeDeep(input) {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return sanitizeForPdf(input);
  if (Array.isArray(input)) return input.map((v) => sanitizeDeep(v));
  if (typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[k] = sanitizeDeep(v);
    return out;
  }
  return input;
}

// ─── Palette & layout ────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const SAGE = rgb(0.561, 0.663, 0.541);
const SAGE_SOFT = rgb(0.678, 0.749, 0.659);
const SAGE_LIGHT = rgb(0.855, 0.89, 0.843);
const FOREST = rgb(0.29, 0.42, 0.29);
const INK = rgb(0.16, 0.16, 0.15);
const MUTED = rgb(0.45, 0.45, 0.42);
const RULE = rgb(0.82, 0.84, 0.8);
const WHITE = rgb(1, 1, 1);

// Zone photo (bandeau haut)
const HERO_H = 300;
const HERO_Y = PAGE_H - HERO_H;

// Ancres fixes du bas de page
const FOOTER_SIRET_Y = MARGIN - 4;
const FOOTER_TVA_Y = MARGIN + 7;
const FOOTER_BASELINE_Y = MARGIN + 26;
const LEGAL_NOTE_Y = MARGIN + 48;
const BLOCKS_TOP = MARGIN + 190;   // haut des blocs acompte / signature
const TABLE_BOTTOM_LIMIT = BLOCKS_TOP + 88; // le tableau + totaux s'arrêtent là

async function loadFonts(pdf) {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
}

// ─── Helpers texte ───────────────────────────────────────────────────
function formatCents(cents) {
  return sanitizeForPdf(
    (cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(iso) {
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

const formatDateUpper = (iso) => formatDate(iso).toUpperCase();

function wrapText(text, font, size, maxWidth) {
  const words = sanitizeForPdf(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
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

function drawParagraph(page, text, opts) {
  const color = opts.color ?? INK;
  const lineGap = opts.lineGap ?? opts.size * 1.5;
  let y = opts.y;
  for (const line of String(text).split("\n")) {
    for (const wrapped of wrapText(line, opts.font, opts.size, opts.maxWidth)) {
      page.drawText(wrapped, { x: opts.x, y, size: opts.size, font: opts.font, color });
      y -= lineGap;
    }
  }
  return y;
}

function rightAlign(page, text, rightX, y, size, font, color = INK) {
  const w = font.widthOfTextAtSize(sanitizeForPdf(String(text)), size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

function centerText(page, text, cx, y, size, font, color = INK) {
  const w = font.widthOfTextAtSize(sanitizeForPdf(String(text)), size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

// ─── Décors ──────────────────────────────────────────────────────────
/** Grande courbe sauge en haut-droite + filet blanc. */
function drawTopRightCurve(page) {
  page.drawSvgPath(
    "M 372 0 C 448 6 500 78 522 168 C 540 242 548 296 596 352 L 596 0 Z",
    { x: 0, y: PAGE_H, color: SAGE_LIGHT, opacity: 0.85 }
  );
  page.drawSvgPath(
    "M 448 0 C 512 10 552 82 570 158 C 582 208 588 244 596 276 L 596 0 Z",
    { x: 0, y: PAGE_H, color: SAGE, opacity: 0.92 }
  );
  page.drawSvgPath("M 430 4 C 500 22 542 96 560 170", {
    x: 0,
    y: PAGE_H,
    borderColor: WHITE,
    borderWidth: 1.4,
    opacity: 0.95,
  });
}

/** Vagues sauge en bas-gauche, traversant toute la largeur. */
function drawBottomCurves(page) {
  page.drawSvgPath(
    "M 0 0 C 90 -46 220 -72 350 -54 C 452 -40 530 -12 596 6 L 596 10 L 0 10 Z",
    { x: 0, y: 132, color: SAGE_LIGHT, opacity: 0.9 }
  );
  page.drawSvgPath(
    "M 0 0 C 84 -40 208 -62 330 -46 C 424 -34 500 -10 596 4 L 596 8 L 0 8 Z",
    { x: 0, y: 96, color: SAGE_SOFT, opacity: 0.95 }
  );
  page.drawSvgPath(
    "M 0 0 C 78 -32 196 -50 312 -36 C 402 -25 486 -6 596 2 L 596 6 L 0 6 Z",
    { x: 0, y: 62, color: SAGE, opacity: 1 }
  );
}

/** Trame de points en triangle (coin bas-droite). */
function drawDotGrid(page, x, y, cols = 12, gap = 5.6) {
  for (let r = 0; r < cols; r++) {
    const count = cols - r;
    for (let c = 0; c < count; c++) {
      page.drawCircle({
        x: x + c * gap,
        y: y + r * gap,
        size: 0.9,
        color: INK,
        opacity: 0.6,
      });
    }
  }
}

/** Logo « Oo » : grand anneau + halo sauge + petit anneau. */
function drawLogo(page, x, y, scale = 1) {
  const r1 = 17 * scale;
  const r2 = 10 * scale;
  page.drawCircle({
    x: x + r1 * 0.5,
    y: y - r1 * 0.2,
    size: r1 * 0.82,
    color: SAGE,
    opacity: 0.5,
  });
  page.drawCircle({ x, y, size: r1, borderColor: INK, borderWidth: 2.6 * scale });
  page.drawCircle({
    x: x + r1 + r2 * 0.9,
    y: y - r1 * 0.2,
    size: r2,
    borderColor: INK,
    borderWidth: 2.3 * scale,
  });
}

// ─── Photo hero ──────────────────────────────────────────────────────
let heroCache;

/** Injection directe du cache — scripts de test locaux uniquement. */
export function __setHeroCacheForTest(v) {
  heroCache = v;
}

export async function fetchHeroImage() {
  if (heroCache !== undefined) return heroCache;
  try {
    const { queryOne } = await import("@/lib/db");
    const row = await queryOne(
      "SELECT value FROM page_content WHERE page = 'home' AND key = 'hero_photo' LIMIT 1"
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
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    heroCache = { bytes: buf, type: isPng ? "png" : "jpg" };
    return heroCache;
  } catch {
    heroCache = null;
    return null;
  }
}

/**
 * Bandeau photo avec fondu sur trois côtés.
 *
 * pdf-lib n'a pas de gradient : on empile des bandes de 0,8 pt qui se
 * chevauchent de 0,5 pt. En dessous de ~1,2 pt le rendu est lisse ;
 * avec des bandes épaisses on voyait des rayures.
 *
 *   gauche  (0 → 34 %)   blanc quasi opaque : zone identité
 *   centre  (34 → 66 %)  photo pleinement visible
 *   droite  (66 → 100 %) fondu vers le blanc : zone titre + courbe
 *   bas     (110 pt)     dissolution vers le corps du document
 */
async function drawHeroPhoto(pdf, page, hero) {
  if (!hero) return;
  try {
    const img =
      hero.type === "png"
        ? await pdf.embedPng(hero.bytes)
        : await pdf.embedJpg(hero.bytes);

    const scale = Math.max(PAGE_W / img.width, HERO_H / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (PAGE_W - drawW) / 2;
    // 0.30 : on garde le haut du sujet (visages) plutôt que le centre.
    const drawY = HERO_Y - (drawH - HERO_H) * 0.3;

    page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH, opacity: 0.92 });

    const step = 0.8;
    const overlap = 0.5;
    const smooth = (u) => u * u * (3 - 2 * u);

    // Fondu gauche
    const leftEnd = PAGE_W * 0.42;
    for (let x = 0; x < leftEnd; x += step) {
      const t = x / leftEnd;
      const a = t < 0.55 ? 0.97 : 0.97 * (1 - smooth((t - 0.55) / 0.45));
      if (a <= 0.005) continue;
      page.drawRectangle({
        x, y: HERO_Y, width: step + overlap, height: HERO_H,
        color: WHITE, opacity: a,
      });
    }

    // Fondu droite
    const rightStart = PAGE_W * 0.6;
    for (let x = rightStart; x < PAGE_W; x += step) {
      const t = (x - rightStart) / (PAGE_W - rightStart);
      const a = 0.97 * smooth(Math.min(1, t / 0.7));
      if (a <= 0.005) continue;
      page.drawRectangle({
        x, y: HERO_Y, width: step + overlap, height: HERO_H,
        color: WHITE, opacity: a,
      });
    }

    // Fondu bas
    const fadeH = 110;
    for (let dy = 0; dy < fadeH; dy += step) {
      const t = dy / fadeH;
      const a = 0.99 * (1 - t) * (1 - t);
      if (a <= 0.005) continue;
      page.drawRectangle({
        x: 0, y: HERO_Y + dy, width: PAGE_W, height: step + overlap,
        color: WHITE, opacity: a,
      });
    }

    // Coupe nette sous la zone
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: HERO_Y, color: WHITE });
  } catch {
    // embed échoué — on continue sans photo
  }
}

// ─── En-tête devis / facture ─────────────────────────────────────────
function drawDocHeader(page, fonts, studio, doc) {
  drawTopRightCurve(page);

  const top = PAGE_H - MARGIN;

  // Colonne gauche : logo, marque, identité, coordonnées
  drawLogo(page, MARGIN + 18, top - 24, 1);
  page.drawText("Romero Photography", {
    x: MARGIN,
    y: top - 66,
    size: 16,
    font: fonts.italic,
    color: rgb(0.42, 0.48, 0.42),
  });

  let y = top - 96;
  page.drawText(studio.company_legal_name, { x: MARGIN, y, size: 10, font: fonts.bold, color: INK });
  y -= 14;
  page.drawText("Photographe de mariage", { x: MARGIN, y, size: 9.5, font: fonts.bold, color: INK });
  y -= 14;
  page.drawText("Nice, Cote d'Azur & France", { x: MARGIN, y, size: 9.5, font: fonts.bold, color: INK });

  y -= 28;
  const ix = MARGIN + 4;
  const tx = MARGIN + 22;

  page.drawCircle({ x: ix + 3, y: y + 3, size: 5.5, borderColor: SAGE, borderWidth: 1.1 });
  page.drawLine({ start: { x: ix - 2.5, y: y + 3 }, end: { x: ix + 8.5, y: y + 3 }, thickness: 0.8, color: SAGE });
  page.drawText("romerophotography.fr", { x: tx, y, size: 9, font: fonts.regular, color: INK });
  y -= 18;

  page.drawCircle({ x: ix + 3, y: y + 3, size: 5.5, borderColor: SAGE, borderWidth: 1.1 });
  page.drawText(studio.company_phone, { x: tx, y, size: 9, font: fonts.regular, color: INK });
  y -= 18;

  page.drawRectangle({ x: ix - 2, y: y - 0.5, width: 11, height: 7.5, borderColor: SAGE, borderWidth: 1.1 });
  page.drawSvgPath("M 0 0 L 5.5 4 L 11 0", { x: ix - 2, y: y + 7, borderColor: SAGE, borderWidth: 0.9 });
  page.drawText(studio.company_email, { x: tx, y, size: 9, font: fonts.regular, color: INK });

  // Colonne droite : date, titre, numéro, dates clés
  const rx = PAGE_W - MARGIN;
  rightAlign(page, formatDateUpper(doc.date), rx, top - 20, 8.5, fonts.bold, FOREST);
  rightAlign(page, doc.title, rx, top - 62, 32, fonts.bold, FOREST);
  rightAlign(page, "N " + doc.reference, rx, top - 88, 13.5, fonts.regular, INK);
  page.drawLine({
    start: { x: rx - 155, y: top - 104 },
    end: { x: rx, y: top - 104 },
    thickness: 0.8,
    color: SAGE,
  });

  let ry = top - 126;
  if (doc.weddingDate) {
    rightAlign(page, "MARIAGE", rx, ry, 8.5, fonts.bold, FOREST);
    ry -= 16;
    rightAlign(page, formatDateUpper(doc.weddingDate), rx, ry, 10.5, fonts.regular, INK);
    ry -= 24;
  }
  if (doc.dueDate) {
    rightAlign(page, "DATE D'ECHEANCE", rx, ry, 8.5, fonts.bold, FOREST);
    ry -= 16;
    rightAlign(page, formatDateUpper(doc.dueDate), rx, ry, 10.5, fonts.regular, INK);
  }

  // Le contenu suivant démarre sous la zone photo, jamais plus haut.
  return Math.min(y - 26, HERO_Y - 6);
}

// ─── Bloc client ─────────────────────────────────────────────────────
function drawClientBlock(page, fonts, client, y, label = "CLIENTS") {
  page.drawText(label, { x: MARGIN, y, size: 9, font: fonts.bold, color: FOREST });
  y -= 16;
  page.drawText(client.name, { x: MARGIN, y, size: 9.5, font: fonts.regular, color: INK });
  y -= 13;
  if (client.address) {
    y = drawParagraph(page, client.address, {
      x: MARGIN, y, font: fonts.regular, size: 9.5, color: INK, maxWidth: 260, lineGap: 13,
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
  return y - 14;
}

// ─── Tableau ─────────────────────────────────────────────────────────
const COLS = [
  { w: 0.215, label: "DESIGNATION" },
  { w: 0.325, label: "DETAIL" },
  { w: 0.115, label: "QUANTITE" },
  { w: 0.17, label: "PRIX UNIT. TTC" },
  { w: 0.175, label: "TOTAL TTC" },
];

function colBounds() {
  const xs = [];
  let acc = MARGIN;
  for (const c of COLS) {
    xs.push(acc);
    acc += c.w * CONTENT_W;
  }
  xs.push(MARGIN + CONTENT_W);
  return xs;
}

function drawLinesTable(page, fonts, lines, startY, vatRatePct, vatApplicable) {
  const xs = colBounds();
  const headH = 26;
  let y = startY;

  page.drawRectangle({ x: MARGIN, y: y - headH, width: CONTENT_W, height: headH, color: SAGE });
  COLS.forEach((c, i) => {
    centerText(page, c.label, (xs[i] + xs[i + 1]) / 2, y - headH + 9.5, 8, fonts.bold, WHITE);
  });
  y -= headH;

  // Hauteur disponible pour le corps du tableau
  const available = y - TABLE_BOTTOM_LIMIT;
  const minRow = 34;

  let subtotal = 0;
  const rows = lines.map((line) => {
    const labelLines = wrapText(line.label, fonts.bold, 9, COLS[0].w * CONTENT_W - 16);
    const bullets = String(line.detail || "")
      .split("\n")
      .map((s) => s.replace(/^[-*·•]\s*/, "").trim())
      .filter(Boolean)
      .map((b) => wrapText(b, fonts.regular, 8.5, COLS[1].w * CONTENT_W - 26));
    const detailCount = bullets.reduce((n, b) => n + b.length, 0);
    const h = Math.max(labelLines.length * 12 + 18, detailCount * 11.5 + 18, minRow);
    return { line, labelLines, bullets, h };
  });

  // Si le contenu déborde, on compresse proportionnellement (jamais sous minRow)
  const totalH = rows.reduce((n, r) => n + r.h, 0);
  const shrink = totalH > available ? available / totalH : 1;

  for (const r of rows) {
    const h = Math.max(minRow, r.h * shrink);
    const lineTotal = r.line.quantity * r.line.unit_price_cents;
    subtotal += lineTotal;

    page.drawRectangle({
      x: MARGIN, y: y - h, width: CONTENT_W, height: h,
      borderColor: RULE, borderWidth: 0.6,
    });
    for (let i = 1; i < xs.length - 1; i++) {
      page.drawLine({
        start: { x: xs[i], y }, end: { x: xs[i], y: y - h },
        thickness: 0.6, color: RULE,
      });
    }

    let ly = y - h / 2 + (r.labelLines.length * 12) / 2 - 8;
    for (const l of r.labelLines) {
      page.drawText(l, { x: xs[0] + 8, y: ly, size: 9, font: fonts.bold, color: INK });
      ly -= 12;
    }

    let dy = y - 15;
    for (const bulletLines of r.bullets) {
      if (dy < y - h + 6) break;
      page.drawCircle({ x: xs[1] + 10, y: dy + 3, size: 1.3, color: INK });
      for (const bl of bulletLines) {
        page.drawText(bl, { x: xs[1] + 17, y: dy, size: 8.5, font: fonts.regular, color: INK });
        dy -= 11.5;
      }
    }

    const mid = y - h / 2 - 3;
    centerText(page, String(r.line.quantity), (xs[2] + xs[3]) / 2, mid, 9, fonts.regular, INK);
    centerText(page, formatCents(r.line.unit_price_cents) + " EUR", (xs[3] + xs[4]) / 2, mid, 9, fonts.regular, INK);
    centerText(page, formatCents(lineTotal) + " EUR", (xs[4] + xs[5]) / 2, mid, 9, fonts.regular, INK);

    y -= h;
  }

  const vat = vatApplicable ? Math.round(subtotal * (vatRatePct / 100)) : 0;
  return { y, subtotal, vat, total: subtotal + vat };
}

/** Bandeau de total aligné à droite. */
function drawTotalBar(page, fonts, label, amountCents, y, opts) {
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
    borderColor: RULE, borderWidth: 0.6,
  });
  page.drawText(label, {
    x: barX + 12, y: y - barH + 8, size: 8.5,
    font: fonts.bold, color: opts?.muted ? FOREST : WHITE,
  });
  rightAlign(page, formatCents(amountCents) + " EUR", PAGE_W - MARGIN - 10, y - barH + 8, 9.5, fonts.bold, INK);
  return y - barH - 6;
}

// ─── Blocs bas ───────────────────────────────────────────────────────
function drawDepositBox(page, fonts, pct, amountCents, x, y, w) {
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

function drawSignatureBox(page, fonts, x, y, w, title = "SIGNATURE") {
  page.drawText(title, { x, y, size: 10, font: fonts.bold, color: FOREST });
  page.drawText('(Precedee de la mention "Bon pour accord")', {
    x, y: y - 13, size: 7.5, font: fonts.regular, color: MUTED,
  });
  page.drawRectangle({
    x, y: y - 64, width: w, height: 44,
    borderColor: FOREST, borderWidth: 0.9,
  });
}

function drawLabeledBox(page, fonts, title, body, x, y, w, h) {
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

function drawFooter(page, fonts, studio, opts) {
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

// ─── DEVIS ───────────────────────────────────────────────────────────
export async function buildQuotePdf(rawInput) {
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

  if (vatApplicable) {
    y = drawTotalBar(page, fonts, "SOUS-TOTAL HT", totals.subtotal, y, { muted: true });
    y = drawTotalBar(page, fonts, "TVA " + vatRate + "%", totals.vat, y, { muted: true });
  }
  drawTotalBar(page, fonts, "MONTANT TOTAL TTC", totals.total, y);

  // Blocs bas — position fixe, jamais de chevauchement
  const halfW = CONTENT_W * 0.42;
  if (input.doc.deposit_pct) {
    const deposit = Math.round((totals.total * input.doc.deposit_pct) / 100);
    drawDepositBox(page, fonts, input.doc.deposit_pct, deposit, MARGIN + 26, BLOCKS_TOP, halfW);
  }
  drawSignatureBox(page, fonts, PAGE_W - MARGIN - halfW - 4, BLOCKS_TOP - 10, halfW);

  const validity = input.doc.validity_days ?? 60;
  page.drawText("Devis valable " + validity + " jours a compter de sa date d'emission.", {
    x: MARGIN, y: LEGAL_NOTE_Y + 14, size: 7.5, font: fonts.italic, color: MUTED,
  });

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}

// ─── FACTURE ─────────────────────────────────────────────────────────
export async function buildInvoicePdf(rawInput) {
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

  y = drawTotalBar(
    page, fonts,
    vatApplicable ? "SOUS-TOTAL HT" : "SOUS-TOTAL TTC",
    totals.subtotal, y, { muted: true }
  );
  if (vatApplicable) {
    y = drawTotalBar(page, fonts, "TVA " + vatRate + "%", totals.vat, y, { muted: true });
  }
  y = drawTotalBar(page, fonts, "TOTAL TTC", totals.total, y, { muted: true });

  const paid = input.doc.already_paid_cents ?? 0;
  if (paid > 0) {
    y = drawTotalBar(page, fonts, "ACOMPTE DEJA VERSE", paid, y, { muted: true });
  }
  drawTotalBar(page, fonts, "MONTANT A PAYER", Math.max(0, totals.total - paid), y);

  // Blocs bas — ancrés, deux colonnes
  const colW = CONTENT_W * 0.42;
  const rightX = PAGE_W - MARGIN - colW - 4;

  drawLabeledBox(
    page, fonts, "CONDITIONS DE PAIEMENT",
    input.doc.payment_terms, MARGIN, BLOCKS_TOP, colW, 40
  );
  drawLabeledBox(
    page, fonts, "COORDONNEES BANCAIRES",
    input.studio.company_iban ? "IBAN : " + input.studio.company_iban : "",
    MARGIN, BLOCKS_TOP - 70, colW, 40
  );
  drawSignatureBox(page, fonts, rightX, BLOCKS_TOP - 40, colW);

  page.drawText(
    "En cas de retard de paiement : penalite de 3x le taux d'interet legal + indemnite forfaitaire de 40 EUR (art. L441-10 C. com.).",
    { x: MARGIN, y: LEGAL_NOTE_Y, size: 6.5, font: fonts.italic, color: MUTED }
  );

  drawFooter(page, fonts, input.studio);
  return pdf.save();
}

// ─── CONTRAT ─────────────────────────────────────────────────────────
// Structure alignée sur le contrat de référence Romero Photography.

function drawFieldLine(page, fonts, label, value, x, y, lineW = 200) {
  const text = label + " :";
  page.drawText(text, { x, y, size: 9, font: fonts.regular, color: INK });
  const vx = x + fonts.regular.widthOfTextAtSize(sanitizeForPdf(text), 9) + 6;
  if (value && String(value).trim()) {
    page.drawText(String(value).trim(), { x: vx, y, size: 9, font: fonts.bold, color: INK });
  } else {
    page.drawLine({
      start: { x: vx, y: y - 2 }, end: { x: vx + lineW, y: y - 2 },
      thickness: 0.6, color: RULE,
    });
  }
}

function drawCheckbox(page, fonts, label, x, y) {
  page.drawRectangle({ x, y: y - 1, width: 9, height: 9, borderColor: FOREST, borderWidth: 0.9 });
  page.drawText(label, { x: x + 16, y, size: 9, font: fonts.regular, color: INK });
}

export async function buildContractPdf(rawInput) {
  const input = sanitizeDeep(rawInput);
  const d = input.doc;
  const st = input.studio;
  const pdf = await PDFDocument.create();
  const fonts = await loadFonts(pdf);
  const hero = await fetchHeroImage();
  let page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
  await drawHeroPhoto(pdf, page, hero);
  drawTopRightCurve(page);

  drawLogo(page, MARGIN + 18, PAGE_H - MARGIN - 24, 0.9);
  centerText(page, "ROMERO PHOTOGRAPHY", PAGE_W / 2, PAGE_H - MARGIN - 76, 22, fonts.bold, FOREST);
  centerText(
    page, "Contrat de prestation photographique de mariage",
    PAGE_W / 2, PAGE_H - MARGIN - 98, 11.5, fonts.regular, INK
  );
  page.drawLine({
    start: { x: PAGE_W / 2 - 74, y: PAGE_H - MARGIN - 112 },
    end: { x: PAGE_W / 2 + 74, y: PAGE_H - MARGIN - 112 },
    thickness: 1.3, color: SAGE,
  });
  rightAlign(page, "N " + d.reference, PAGE_W - MARGIN, PAGE_H - MARGIN - 16, 9, fonts.bold, FOREST);
  rightAlign(page, formatDate(d.issue_date), PAGE_W - MARGIN, PAGE_H - MARGIN - 28, 8.5, fonts.regular, MUTED);

  let y = HERO_Y - 16;
  const bottom = MARGIN + 84;
  const newPage = () => {
    drawFooter(page, fonts, st, { decorated: false });
    page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));
    y = PAGE_H - MARGIN - 26;
  };
  const ensureRoom = (need) => {
    if (y - need < bottom) newPage();
  };

  page.drawText("Entre les soussignes :", { x: MARGIN, y, size: 10, font: fonts.italic, color: INK });
  y -= 28;

  const heading = (t) => {
    page.drawText(t, { x: MARGIN, y, size: 12, font: fonts.bold, color: FOREST });
    page.drawLine({
      start: { x: MARGIN, y: y - 5 }, end: { x: MARGIN + 42, y: y - 5 },
      thickness: 1.4, color: SAGE,
    });
    y -= 22;
  };

  heading("Le Photographe");
  for (const l of [
    "Romero Photography - " + st.company_legal_name,
    st.company_address,
    "Tel. : " + st.company_phone,
    "Site : https://romerophotography.fr",
    "E-mail : " + st.company_email,
    "SIRET : " + st.company_siret,
  ]) {
    y = drawParagraph(page, l, {
      x: MARGIN, y, font: fonts.regular, size: 9, color: INK, maxWidth: CONTENT_W, lineGap: 13,
    });
  }
  y -= 18;

  ensureRoom(130);
  heading("Les Clients");
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
  y -= 28;

  ensureRoom(160);
  heading("Informations concernant le mariage");
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
    d.wedding.guest_count ? String(d.wedding.guest_count) : undefined, MARGIN, y, 210
  );
  y -= 17;
  drawFieldLine(page, fonts, "Formule reservee", d.formula_name, MARGIN, y, 210);
  y -= 17;
  drawFieldLine(page, fonts, "Options", d.options, MARGIN, y, 240);
  y -= 32;

  const article = (num, title, body) => {
    ensureRoom(76);
    page.drawText(num + ". " + title, { x: MARGIN, y, size: 11.5, font: fonts.bold, color: FOREST });
    y -= 18;
    y = drawParagraph(page, body, {
      x: MARGIN, y, font: fonts.regular, size: 9.5, color: INK, maxWidth: CONTENT_W, lineGap: 13,
    });
    y -= 15;
  };

  article(1, "Objet",
    "Le present contrat definit les conditions de realisation de la prestation photographique de mariage.");

  const deposit = Math.round((d.price_cents * d.deposit_pct) / 100);
  const balance = d.price_cents - deposit;
  const vatApplicable = st.vat_status === "yes";
  article(2, "Conditions financieres",
    "Montant total : " + formatCents(d.price_cents) + " EUR TTC - Acompte : " +
    formatCents(deposit) + " EUR (" + d.deposit_pct + " %). Solde de " +
    formatCents(balance) + " EUR a regler selon les conditions convenues." +
    (vatApplicable ? "" : " TVA non applicable, article 293 B du CGI."));

  article(3, "Reservation",
    "La reservation est definitive a reception du contrat signe et de l'acompte.");
  article(4, "Obligations des clients",
    "Les clients s'engagent a communiquer toutes les informations utiles au bon deroulement de la prestation.");
  article(5, "Obligations du photographe",
    "Le photographe met tout en oeuvre pour realiser la prestation avec professionnalisme.");
  article(6, "Repas du photographe",
    "Si la formule comprend une presence pendant le repas (notamment les formules incluant l'ouverture de bal), les clients s'engagent a prevoir un repas complet pour le photographe.");
  article(7, "Livraison",
    "Les photographies seront livrees via une galerie privee en ligne.");
  article(8, "Droit d'auteur",
    "Le photographe conserve les droits d'auteur. Les clients disposent d'un droit d'usage prive.");

  ensureRoom(84);
  page.drawText("9. Droit a l'image", { x: MARGIN, y, size: 11.5, font: fonts.bold, color: FOREST });
  y -= 21;
  drawCheckbox(page, fonts, "J'autorise Romero Photography a utiliser certaines photographies.", MARGIN, y);
  y -= 18;
  drawCheckbox(page, fonts, "Je refuse toute utilisation.", MARGIN, y);
  y -= 30;

  if (d.cancellation_policy) article(10, "Annulation", d.cancellation_policy);
  if (st.contract_extra_clauses) {
    article(d.cancellation_policy ? 11 : 10, "Clauses additionnelles", st.contract_extra_clauses);
  }

  ensureRoom(140);
  drawFieldLine(page, fonts, "Fait a", undefined, MARGIN, y, 130);
  drawFieldLine(page, fonts, "Le", undefined, MARGIN + 250, y, 130);
  y -= 36;

  const halfW = CONTENT_W * 0.44;
  page.drawText("Signature des Clients :", { x: MARGIN, y, size: 9.5, font: fonts.regular, color: INK });
  page.drawText('(precedee de la mention "Bon pour accord")', {
    x: MARGIN, y: y - 12, size: 7.5, font: fonts.italic, color: MUTED,
  });
  page.drawRectangle({
    x: MARGIN, y: y - 64, width: halfW, height: 46,
    borderColor: FOREST, borderWidth: 0.9,
  });

  const rx = MARGIN + CONTENT_W * 0.52;
  page.drawText("Signature Romero Photography :", { x: rx, y, size: 9.5, font: fonts.regular, color: INK });
  page.drawRectangle({
    x: rx, y: y - 64, width: halfW, height: 46,
    borderColor: FOREST, borderWidth: 0.9,
  });

  drawFooter(page, fonts, st);
  return pdf.save();
}
`;

// Le fichier est du TS : on réinjecte les annotations de type minimales
// nécessaires au build Next (les types exportés sont consommés ailleurs).
const TYPES = `
// ─── Types métier (ré-exportés pour les consommateurs) ───────────────
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
  postal_city?: string;
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
  client: Client;
  wedding: {
    date: string;
    location: string;
    guest_count?: number;
    ceremony_time?: string;
    end_time?: string;
    prep_location?: string;
    ceremony_location?: string;
    reception_location?: string;
  };
  formula_name: string;
  formula_description: string;
  options?: string;
  price_cents: number;
  deposit_pct: number;
  cancellation_policy?: string;
  image_rights?: string;
  force_majeure?: string;
  jurisdiction?: string;
};
`;

// Insère les types juste après les imports
const out = SRC.replace(
  'import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";',
  'import { PDFDocument, StandardFonts, rgb } from "pdf-lib";\n' + TYPES
);

fs.writeFileSync("src/lib/pdf-generator.ts", out);
console.log("pdf-generator.ts rebuilt (" + out.length + " chars)");
