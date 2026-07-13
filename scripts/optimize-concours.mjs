// One-off image optimization for the /concours page.
// Turns the 4 large source photos (13 MB total) into responsive WebP
// variants small enough for a sub-second LCP.
//
// Outputs :
//   portrait-mickael-{md,lg}.webp  (poster + main portrait, 900w / 1400w)
//   safari-tanzanie.webp           (prize photo, 1400w)
//   maries-zanzibar.webp           (prize photo, 1400w)
//   logo-sansanlaclak.webp         (partner logo, 320w, transparent-safe)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = "public/uploads/concours";

async function encode(src, dst, width, quality = 78) {
  const buf = await sharp(path.join(DIR, src))
    .rotate()
    .resize({ width, withoutEnlargement: true, fit: "inside" })
    .webp({ quality, effort: 6 })
    .toBuffer();
  fs.writeFileSync(path.join(DIR, dst), buf);
  const kb = (buf.length / 1024).toFixed(0);
  console.log(`  ${dst.padEnd(34)} ${width}w  ${kb} KB`);
}

console.log("Optimisation des images concours →");
// Portrait Mickael : sert de poster vidéo (< 900w suffit)
//                    + version 1400w si besoin d'un rendu large en fallback.
await encode("portrait-mickael.jpeg", "portrait-mickael-md.webp", 900, 78);
await encode("portrait-mickael.jpeg", "portrait-mickael-lg.webp", 1400, 78);
// Prix : safari + Zanzibar en 1400w suffit pour un affichage 4/5
await encode("safari-tanzanie.png",  "safari-tanzanie.webp",     1400, 78);
await encode("maries-zanzibar.png",  "maries-zanzibar.webp",     1400, 78);
// Logo partenaire : petit, transparence pas critique (fond crème derrière)
await encode("logo-sansanlaclak.jpeg", "logo-sansanlaclak.webp", 320, 82);
console.log("Terminé.");
