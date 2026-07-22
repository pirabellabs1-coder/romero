import fs from "node:fs";
const p = "src/lib/pdf-generator.ts";
let s = fs.readFileSync(p, "utf8");

// Devis + Facture : page puis fonts
s = s.split(
  "  const page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));\n  const fonts = await loadFonts(pdf);\n"
).join(
  "  const page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));\n  const fonts = await loadFonts(pdf);\n  await drawHeroPhoto(pdf, page, await fetchHeroImage());\n"
);

// Contrat : fonts puis page
s = s.split(
  "  const fonts = await loadFonts(pdf);\n  let page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));\n"
).join(
  "  const fonts = await loadFonts(pdf);\n  let page = wrapPage(pdf.addPage([PAGE_W, PAGE_H]));\n  await drawHeroPhoto(pdf, page, await fetchHeroImage());\n"
);

fs.writeFileSync(p, s);
console.log("patched");
