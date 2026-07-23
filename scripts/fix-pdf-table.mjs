import fs from "node:fs";
const p = "src/lib/pdf-generator.ts";
let s = fs.readFileSync(p, "utf8");

// 1. Réduire le bandeau photo (300 -> 208) pour libérer ~90pt de contenu.
s = s.replace("const HERO_H = 300;", "const HERO_H = 208;");

// 2. Remplacer drawLinesTable : hauteurs naturelles, clipping STRICT,
//    aucun texte dessiné hors de sa ligne.
const tableStart = "function drawLinesTable(";
const tableEnd = "/** Bandeau de total aligné à droite. */";
const a = s.indexOf(tableStart);
const b = s.indexOf(tableEnd);
if (a < 0 || b < 0) throw new Error("drawLinesTable markers not found");

const newTable = `function drawLinesTable(
  page: PDFPage,
  fonts: Fonts,
  lines: DocumentLine[],
  startY: number,
  vatRatePct: number,
  vatApplicable: boolean
): { y: number; subtotal: number; vat: number; total: number } {
  const xs = colBounds();
  const headH = 24;
  let y = startY;

  // En-tête sauge
  page.drawRectangle({ x: MARGIN, y: y - headH, width: CONTENT_W, height: headH, color: SAGE });
  COLS.forEach((c, i) => {
    centerText(page, c.label, (xs[i] + xs[i + 1]) / 2, y - headH + 8.5, 7.5, fonts.bold, WHITE);
  });
  y -= headH;

  const labelW = COLS[0].w * CONTENT_W - 14;
  const detailW = COLS[1].w * CONTENT_W - 24;
  const lineH = 11;      // interligne label et puces
  const padV = 9;        // marge verticale interne haut/bas
  const minRow = 30;

  // Pré-calcul des lignes wrappées + hauteur naturelle
  let subtotal = 0;
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

  for (const r of rows) {
    const h = r.h;
    const rowTop = y;
    const rowBottom = y - h;
    const lineTotal = r.line.quantity * r.line.unit_price_cents;
    subtotal += lineTotal;

    // Cadre + séparateurs de colonnes
    page.drawRectangle({
      x: MARGIN, y: rowBottom, width: CONTENT_W, height: h,
      borderColor: RULE, borderWidth: 0.6,
    });
    for (let i = 1; i < xs.length - 1; i++) {
      page.drawLine({
        start: { x: xs[i], y: rowTop }, end: { x: xs[i], y: rowBottom },
        thickness: 0.6, color: RULE,
      });
    }

    // Colonne DESIGNATION (label, centré verticalement, clippé)
    let ly = rowTop - padV - 8 + ((h - 2 * padV) - r.labelLines.length * lineH) / 2;
    if (ly > rowTop - padV - 8) ly = rowTop - padV - 8;
    for (const l of r.labelLines) {
      if (ly < rowBottom + 4) break; // clip strict
      page.drawText(l, { x: xs[0] + 7, y: ly, size: 8.5, font: fonts.bold, color: INK });
      ly -= lineH;
    }

    // Colonne DETAIL (puces, clippées strictement)
    let dy = rowTop - padV - 6;
    for (const bulletLines of r.bullets) {
      if (dy < rowBottom + 4) break;
      page.drawCircle({ x: xs[1] + 9, y: dy + 3, size: 1.2, color: INK });
      for (const bl of bulletLines) {
        if (dy < rowBottom + 4) break;
        page.drawText(bl, { x: xs[1] + 15, y: dy, size: 8, font: fonts.regular, color: INK });
        dy -= lineH;
      }
    }

    // Colonnes chiffrées (centrées verticalement)
    const mid = rowTop - h / 2 - 3;
    centerText(page, String(r.line.quantity), (xs[2] + xs[3]) / 2, mid, 8.5, fonts.regular, INK);
    centerText(page, formatCents(r.line.unit_price_cents) + " EUR", (xs[3] + xs[4]) / 2, mid, 8.5, fonts.regular, INK);
    centerText(page, formatCents(lineTotal) + " EUR", (xs[4] + xs[5]) / 2, mid, 8.5, fonts.regular, INK);

    y = rowBottom;
  }

  const vat = vatApplicable ? Math.round(subtotal * (vatRatePct / 100)) : 0;
  return { y, subtotal, vat, total: subtotal + vat };
}

`;

s = s.slice(0, a) + newTable + s.slice(b);

fs.writeFileSync(p, s);
console.log("table rewritten, HERO_H=208");
