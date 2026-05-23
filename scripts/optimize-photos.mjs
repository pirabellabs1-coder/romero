#!/usr/bin/env node
/**
 * Optimize all photos referenced by the `photos` table:
 * - Resizes any image whose larger dimension exceeds MAX_DIM down to MAX_DIM
 * - Re-encodes JPG / PNG / WebP as WebP at QUALITY (good balance of quality + size)
 * - Renames the file (.webp) and updates the photos.filename column
 * - Skips files already ≤ MAX_DIM AND already .webp under MAX_BYTES
 *
 * Usage:
 *   node scripts/optimize-photos.mjs
 *   node scripts/optimize-photos.mjs --dry-run
 *   node scripts/optimize-photos.mjs --max-dim=2400 --quality=82
 */

import sharp from "sharp";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(SITE_ROOT, "data", "romero.db");
const UPLOADS_DIR = path.join(SITE_ROOT, "public", "uploads");

const args = process.argv.slice(2);
const arg = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const dryRun = args.includes("--dry-run");
const MAX_DIM = Number(arg("max-dim", 2200));
const QUALITY = Number(arg("quality", 80));
const MAX_BYTES_KEEP = 400 * 1024; // already ≤ 400KB and webp → skip

if (!fs.existsSync(DB_PATH)) {
  console.error(`✗ DB not found: ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const photos = db.prepare("SELECT id, gallery_id, filename FROM photos").all();
console.log(`Found ${photos.length} photo row(s). Max dim: ${MAX_DIM}, quality: ${QUALITY}. Dry-run: ${dryRun}\n`);

const updateFilename = db.prepare("UPDATE photos SET filename = ? WHERE id = ?");

let optimized = 0;
let skipped = 0;
let errors = 0;
let savedBytes = 0;

for (const row of photos) {
  if (row.filename === "hero.jpg") { skipped++; continue; }
  const abs = path.join(UPLOADS_DIR, row.filename);
  if (!fs.existsSync(abs)) {
    console.error(`  ✗ missing file: ${row.filename}`);
    errors++;
    continue;
  }

  let meta;
  try { meta = await sharp(abs).metadata(); }
  catch (e) { console.error(`  ✗ metadata failed for ${row.filename}: ${e.message}`); errors++; continue; }

  const origSize = fs.statSync(abs).size;
  const dim = Math.max(meta.width || 0, meta.height || 0);
  const isWebp = (meta.format === "webp") || abs.toLowerCase().endsWith(".webp");

  // Skip if already small enough AND already webp
  if (isWebp && dim <= MAX_DIM && origSize <= MAX_BYTES_KEEP) {
    skipped++;
    continue;
  }

  const targetRel = row.filename.replace(/\.(png|jpe?g|webp|gif)$/i, ".webp");
  const targetAbs = path.join(UPLOADS_DIR, targetRel);

  if (dryRun) {
    console.log(`  would optimize ${row.filename}  (${(origSize / 1024).toFixed(0)}KB, ${meta.width}x${meta.height})  →  ${path.basename(targetRel)}`);
    optimized++;
    continue;
  }

  try {
    // Write to a temp file first to avoid corrupting the source if it's the same path
    const tmp = targetAbs + ".tmp";
    let pipeline = sharp(abs).rotate();
    if (dim > MAX_DIM) pipeline = pipeline.resize({ width: meta.width >= meta.height ? MAX_DIM : null, height: meta.height > meta.width ? MAX_DIM : null, fit: "inside", withoutEnlargement: true });
    await pipeline.webp({ quality: QUALITY, effort: 5 }).toFile(tmp);

    // Replace original
    if (abs !== targetAbs) {
      try { fs.unlinkSync(abs); } catch {}
    } else {
      // overwriting same path
    }
    fs.renameSync(tmp, targetAbs);

    if (targetRel !== row.filename) {
      updateFilename.run(targetRel, row.id);
    }
    const newSize = fs.statSync(targetAbs).size;
    savedBytes += (origSize - newSize);
    optimized++;
    process.stdout.write(`  ✓ ${row.filename}  →  ${path.basename(targetRel)}  (${(origSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB)\n`);
  } catch (e) {
    console.error(`  ✗ failed ${row.filename}: ${e.message}`);
    errors++;
  }
}

console.log(`\nDone. Optimized: ${optimized}, skipped: ${skipped}, errors: ${errors}.`);
if (!dryRun && savedBytes > 0) {
  console.log(`Saved ${(savedBytes / (1024 * 1024)).toFixed(1)} MB total.`);
}
