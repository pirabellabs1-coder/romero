import fs from "node:fs";
const p = "src/lib/pdf-generator.ts";
const s = fs.readFileSync(p, "utf8");

const startMarker = "/**\n * Dessine la photo hero dans la zone header";
const endMarker = "// ─── En-tête commun (devis / facture) ─";
const a = s.indexOf(startMarker);
const b = s.indexOf(endMarker);
if (a < 0 || b < 0) throw new Error("markers not found");

const fn = `/**
 * Dessine la photo hero dans la zone header.
 *
 * pdf-lib n'a pas de gradient natif : on simule le fondu par des bandes
 * très fines qui se chevauchent (0.9 pt de large, +0.6 pt de recouvrement).
 * En dessous de ~1.2 pt par bande le rendu est indiscernable d'un vrai
 * dégradé, alors qu'avec 26 grosses bandes on voyait des rayures.
 *
 * Trois masques successifs :
 *   1. Fondu horizontal — blanc opaque à gauche (zone texte), transparent
 *      à droite (photo visible), via une courbe smoothstep.
 *   2. Fondu vertical bas — la photo se dissout vers le corps blanc.
 *   3. Coupe nette — tout ce qui dépasse sous la zone est masqué en blanc
 *      opaque (sinon la photo débordait derrière le bloc CLIENTS).
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

    const zoneH = 196;
    const zoneY = PAGE_H - zoneH;

    // Cadrage « cover » : on remplit la zone sans déformer.
    const scale = Math.max(PAGE_W / img.width, zoneH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (PAGE_W - drawW) / 2;
    // 0.38 = on garde le haut du sujet (visages) plutôt que le centre.
    const drawY = zoneY - (drawH - zoneH) * 0.38;

    page.drawImage(img, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
      opacity: 0.5,
    });

    // ── 1. Fondu horizontal (bandes verticales très fines) ──
    // smoothstep : blanc plein jusqu'à 30 % de la largeur, puis descente
    // douce jusqu'à 72 % où la photo est pleinement visible.
    const fadeEndX = PAGE_W * 0.72;
    const stepX = 0.9;
    for (let x = 0; x < fadeEndX; x += stepX) {
      const t = x / fadeEndX;
      let a: number;
      if (t < 0.3) {
        a = 0.96;
      } else {
        const u = (t - 0.3) / 0.7;          // 0 → 1
        const sm = u * u * (3 - 2 * u);     // smoothstep
        a = 0.96 * (1 - sm);
      }
      if (a <= 0.004) continue;
      page.drawRectangle({
        x,
        y: zoneY,
        width: stepX + 0.6,                 // chevauchement anti-rayures
        height: zoneH,
        color: WHITE,
        opacity: a,
      });
    }

    // ── 2. Fondu vertical vers le bas ──
    // Sur les 78 derniers points, la photo se dissout dans le blanc.
    const fadeH = 78;
    const stepY = 0.9;
    for (let dy = 0; dy < fadeH; dy += stepY) {
      const t = dy / fadeH;                 // 0 en bas de zone, 1 plus haut
      const sm = 1 - t;
      const a = 0.99 * sm * sm;
      if (a <= 0.004) continue;
      page.drawRectangle({
        x: 0,
        y: zoneY + dy,
        width: PAGE_W,
        height: stepY + 0.6,
        color: WHITE,
        opacity: a,
      });
    }

    // ── 3. Coupe nette sous la zone ──
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: zoneY,
      color: WHITE,
    });
  } catch {
    // embed échoué (format exotique) — on continue sans photo
  }
}

`;

fs.writeFileSync(p, s.slice(0, a) + fn + s.slice(b));
console.log("hero fade rewritten");
