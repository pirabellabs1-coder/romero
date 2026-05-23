#!/usr/bin/env node
/**
 * Smart-import: walks C:\Romero\ for "Mariage X & Y" / "mariage X & Y" / "photo mariage X & Y"
 * sub-folders, matches each to a gallery in the DB by slug/name, and imports all
 * images inside.
 *
 *   - Copies (does NOT move) files to public/uploads/galleries/<gallery-id>/<orig>
 *   - Inserts rows into the photos table
 *   - Removes the seed hero.jpg row from any gallery that now has real photos
 *   - Sets the first real photo as cover (replacing the hero.jpg placeholder cover)
 *   - Skips files already imported (by source basename) so it's safe to re-run
 *
 * Usage:
 *   node scripts/import-wedding-folders.mjs
 *   node scripts/import-wedding-folders.mjs --root="C:\\Romero" --reset
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const rootArg = args.find((a) => a.startsWith("--root="))?.split("=")[1];
const reset = args.includes("--reset");
const SEARCH_ROOT = rootArg || path.resolve(SITE_ROOT, "..");

const DB_PATH = path.join(SITE_ROOT, "data", "romero.db");
const UPLOADS_DIR = path.join(SITE_ROOT, "public", "uploads");
const GAL_DIR = path.join(UPLOADS_DIR, "galleries");

if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ DB not found: ${DB_PATH}. Run the app once first.`);
  process.exit(1);
}
if (!fs.existsSync(GAL_DIR)) fs.mkdirSync(GAL_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

// ---------- Helpers ----------
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;

/** Strip diacritics + lowercase + only [a-z0-9 &] */
function norm(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Try to match folder name → gallery row */
function findGalleryForFolder(folderName, galleries) {
  const folder = norm(folderName);
  // strip leading "mariage" / "photo mariage"
  const stripped = folder.replace(/^(photo\s+)?mariage\s+/, "");
  for (const g of galleries) {
    const slugTokens = g.slug.split("-");
    const allTokensIn = slugTokens.every((tok) => stripped.includes(tok.toLowerCase()));
    if (allTokensIn) return g;
  }
  // 2nd pass: match by name (e.g. "Anastasia & Jordan" → "anastasia jordan")
  for (const g of galleries) {
    const n = norm(g.names);
    if (stripped === n || stripped.includes(n)) return g;
  }
  return null;
}

function findWeddingFolders(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const lowered = entry.name.toLowerCase();
    if (lowered === "site" || lowered === "design" || lowered.startsWith(".")) continue;
    if (!/mariage/i.test(entry.name)) continue;
    out.push({ name: entry.name, abs: path.join(root, entry.name) });
  }
  return out;
}

function listImages(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!IMG_RE.test(entry.name)) continue;
    out.push({ name: entry.name, abs: path.join(dir, entry.name), size: fs.statSync(path.join(dir, entry.name)).size });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Main ----------
const galleries = db
  .prepare("SELECT id, slug, names, cover_photo_id FROM galleries ORDER BY sort_order ASC")
  .all();

if (galleries.length === 0) {
  console.error("✗ No galleries in DB. Open /admin/galleries and create some first.");
  process.exit(1);
}

if (reset) {
  console.log("⚠ --reset: deleting all existing photo rows + files (except hero.jpg).");
  for (const row of db.prepare("SELECT filename FROM photos").all()) {
    if (row.filename === "hero.jpg") continue;
    const full = path.join(UPLOADS_DIR, row.filename);
    if (fs.existsSync(full)) {
      try { fs.unlinkSync(full); } catch {}
    }
  }
  db.prepare("UPDATE galleries SET cover_photo_id = NULL").run();
  db.prepare("DELETE FROM photos").run();
}

const weddingDirs = findWeddingFolders(SEARCH_ROOT);
if (weddingDirs.length === 0) {
  console.log(`ℹ No "mariage *" folders found in ${SEARCH_ROOT}`);
  process.exit(0);
}

console.log(`Scanning ${weddingDirs.length} folder(s) in ${SEARCH_ROOT}\n`);

const insPhoto = db.prepare(
  "INSERT INTO photos (gallery_id, filename, alt, span, sort_order) VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order)+1 FROM photos WHERE gallery_id = ?), 0))"
);
const findExistingByFilename = db.prepare(
  "SELECT id, filename FROM photos WHERE gallery_id = ? AND filename = ?"
);
const setCover = db.prepare("UPDATE galleries SET cover_photo_id = ? WHERE id = ?");
const findFirstNonHero = db.prepare(
  "SELECT id FROM photos WHERE gallery_id = ? AND filename != 'hero.jpg' ORDER BY sort_order ASC, id ASC LIMIT 1"
);
const deleteHeroRowsForPopulated = db.prepare(`
  DELETE FROM photos
  WHERE filename = 'hero.jpg'
    AND gallery_id IN (
      SELECT gallery_id FROM photos
      WHERE filename != 'hero.jpg'
      GROUP BY gallery_id
    )
`);

const SPANS_POOL = ["", "wide", "", "tall", "", "", "wide", "", "tall", "big", "", ""];

const report = [];

for (const dir of weddingDirs) {
  const gallery = findGalleryForFolder(dir.name, galleries);
  if (!gallery) {
    report.push({ folder: dir.name, status: "✗ no matching gallery", imported: 0 });
    continue;
  }

  const images = listImages(dir.abs);
  if (images.length === 0) {
    report.push({ folder: dir.name, status: "ℹ empty", imported: 0 });
    continue;
  }

  // Make per-gallery sub-folder
  const galleryFolderName = `g${gallery.id}-${gallery.slug}`;
  const galleryAbsDir = path.join(GAL_DIR, galleryFolderName);
  if (!fs.existsSync(galleryAbsDir)) fs.mkdirSync(galleryAbsDir, { recursive: true });

  let imported = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    let spanIdx = 0;
    images.forEach((img, i) => {
      // Sanitize filename: only ASCII + remove spaces
      const safeName = img.name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .toLowerCase();
      const relStored = `galleries/${galleryFolderName}/${safeName}`;
      const existing = findExistingByFilename.get(gallery.id, relStored);
      if (existing) { skipped++; return; }

      const target = path.join(UPLOADS_DIR, relStored);
      try {
        fs.copyFileSync(img.abs, target);
      } catch (e) {
        console.error(`  ✗ failed to copy ${img.name}: ${e.message}`);
        return;
      }
      // Give a tasteful mix of spans (but no span on the first two, they'll be "standard")
      const span = i < 2 ? "" : SPANS_POOL[spanIdx++ % SPANS_POOL.length];
      insPhoto.run(gallery.id, relStored, gallery.names, span, gallery.id);
      imported++;
    });
  });
  tx();

  // Update cover if currently null OR if it points to hero.jpg
  const fresh = db.prepare("SELECT cover_photo_id, (SELECT filename FROM photos WHERE id = g.cover_photo_id) AS cf FROM galleries g WHERE id = ?").get(gallery.id);
  if (!fresh.cover_photo_id || fresh.cf === "hero.jpg") {
    const first = findFirstNonHero.get(gallery.id);
    if (first) {
      setCover.run(first.id, gallery.id);
    }
  }

  report.push({
    folder: dir.name,
    gallery: gallery.slug,
    imported,
    skipped,
    status: imported > 0 ? "✓" : (skipped > 0 ? "↺ already imported" : "✗ none"),
  });
}

// Cleanup placeholder hero.jpg rows from now-populated galleries
const cleaned = deleteHeroRowsForPopulated.run();

console.log("Import results:");
console.table(report);
if (cleaned.changes > 0) {
  console.log(`\n✓ Removed ${cleaned.changes} hero.jpg placeholder row(s) from populated galleries.`);
}

const summary = db.prepare(`
  SELECT g.slug, g.names,
         (SELECT COUNT(*) FROM photos WHERE gallery_id = g.id) AS photos,
         (SELECT filename FROM photos WHERE id = g.cover_photo_id) AS cover
  FROM galleries g
  ORDER BY g.sort_order
`).all();
console.log("\nFinal gallery state:");
console.table(summary);

console.log("\nDone. Refresh the site to see the new photos.");
