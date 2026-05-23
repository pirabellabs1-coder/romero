#!/usr/bin/env node
/**
 * Import all images from public/uploads/seed/ into the database,
 * distributing them across existing galleries.
 *
 * - Files are MOVED (not copied) into public/uploads/galleries/<filename>
 * - A `photos` row is created for each
 * - Distribution is round-robin across galleries (oldest first)
 * - For any gallery without a cover_photo_id, the first imported photo is set as cover
 *
 * Usage:
 *   node scripts/import-seed-photos.mjs
 *   node scripts/import-seed-photos.mjs --gallery=anastasia-jordan   # only one gallery
 *   node scripts/import-seed-photos.mjs --reset                       # delete all existing photos first
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "romero.db");
const SEED_DIR = path.join(ROOT, "public", "uploads", "seed");
const GAL_DIR = path.join(ROOT, "public", "uploads", "galleries");

const args = process.argv.slice(2);
const onlyGallery = args.find((a) => a.startsWith("--gallery="))?.split("=")[1];
const reset = args.includes("--reset");

if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ DB not found at ${DB_PATH}. Run the app once to initialize.`);
  process.exit(1);
}
if (!fs.existsSync(SEED_DIR)) {
  fs.mkdirSync(SEED_DIR, { recursive: true });
  console.error(`✗ Seed dir was empty. Created ${SEED_DIR}. Put images there and re-run.`);
  process.exit(1);
}
if (!fs.existsSync(GAL_DIR)) fs.mkdirSync(GAL_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const files = fs
  .readdirSync(SEED_DIR)
  .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
  .sort();

if (files.length === 0) {
  console.log("ℹ No images found in", SEED_DIR);
  process.exit(0);
}

let galleries = db
  .prepare("SELECT id, slug, names, cover_photo_id FROM galleries ORDER BY sort_order ASC, id ASC")
  .all();

if (onlyGallery) {
  galleries = galleries.filter((g) => g.slug === onlyGallery);
  if (galleries.length === 0) {
    console.error(`✗ No gallery with slug "${onlyGallery}"`);
    process.exit(1);
  }
}

if (galleries.length === 0) {
  console.error("✗ No galleries in DB. Create at least one via /admin/galleries first.");
  process.exit(1);
}

if (reset) {
  console.log("⚠ --reset: deleting all existing photos and unsetting covers.");
  // remove physical files except hero.jpg
  for (const row of db.prepare("SELECT filename FROM photos").all()) {
    if (row.filename === "hero.jpg" || row.filename.startsWith("hero")) continue;
    const full = path.join(ROOT, "public", "uploads", row.filename);
    if (fs.existsSync(full)) {
      try { fs.unlinkSync(full); } catch {}
    }
  }
  db.prepare("UPDATE galleries SET cover_photo_id = NULL").run();
  db.prepare("DELETE FROM photos").run();
}

const insPhoto = db.prepare(
  "INSERT INTO photos (gallery_id, filename, alt, span, sort_order) VALUES (?, ?, '', '', COALESCE((SELECT MAX(sort_order)+1 FROM photos WHERE gallery_id = ?), 0))"
);
const setCover = db.prepare("UPDATE galleries SET cover_photo_id = ? WHERE id = ?");

console.log(`Importing ${files.length} file(s) across ${galleries.length} gallery/galleries...`);

let imported = 0;
const SPANS = ["", "wide", "tall", ""];
let spanIdx = 0;

const tx = db.transaction(() => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const gallery = galleries[i % galleries.length];
    const ext = path.extname(file).toLowerCase();
    const ts = Date.now().toString(36) + "-" + i.toString(36);
    const targetName = `galleries/g${gallery.id}-${ts}${ext}`;
    const targetPath = path.join(ROOT, "public", "uploads", targetName);

    // Move file (rename); falls back to copy+unlink if cross-device
    try {
      fs.renameSync(path.join(SEED_DIR, file), targetPath);
    } catch {
      fs.copyFileSync(path.join(SEED_DIR, file), targetPath);
      try { fs.unlinkSync(path.join(SEED_DIR, file)); } catch {}
    }

    const span = i < galleries.length * 2 ? "" : SPANS[spanIdx++ % SPANS.length];
    const r = insPhoto.run(gallery.id, targetName, gallery.names, span, gallery.id);
    const photoId = Number(r.lastInsertRowid);
    imported++;

    // Refresh cover_photo_id if gallery has none or still points to hero.jpg
    const current = db.prepare("SELECT cover_photo_id, (SELECT filename FROM photos WHERE id = g.cover_photo_id) AS cf FROM galleries g WHERE id = ?").get(gallery.id);
    if (!current.cover_photo_id || current.cf === "hero.jpg") {
      setCover.run(photoId, gallery.id);
    }
  }
});
tx();

// Drop seed hero placeholder cover for galleries that now have real photos
const cleanupHero = db.prepare(`
  DELETE FROM photos
  WHERE filename = 'hero.jpg'
    AND gallery_id IN (
      SELECT gallery_id FROM photos
      WHERE filename != 'hero.jpg'
      GROUP BY gallery_id
    )
`);
const cleaned = cleanupHero.run();

console.log(`\n✓ Imported ${imported} photo(s).`);
if (cleaned.changes > 0) console.log(`✓ Removed ${cleaned.changes} placeholder hero.jpg row(s) from now-populated galleries.`);

const summary = db.prepare(`
  SELECT g.slug, g.names, COUNT(p.id) AS photos, (SELECT filename FROM photos WHERE id = g.cover_photo_id) AS cover
  FROM galleries g LEFT JOIN photos p ON p.gallery_id = g.id
  GROUP BY g.id ORDER BY g.sort_order
`).all();
console.log("\nFinal state:");
console.table(summary);
console.log("\nDone. Refresh your site to see the new photos.");
