/**
 * One-off script: update the admin user's email + password in the
 * production SQLite snapshot stored on Vercel Blob.
 *
 * 1. Download latest DB snapshot from Blob
 * 2. Generate a strong 20-character random password
 * 3. Update users table: email + bcrypt-hashed password
 * 4. Upload DB back to Blob (overwrites previous snapshot)
 * 5. Print credentials to stdout (caller copies them to a secure place)
 *
 * Usage: node scripts/update-admin-creds.mjs <newEmail>
 *
 * Reads BLOB_READ_WRITE_TOKEN from .env.production (already pulled
 * from Vercel by `vercel env pull`).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { head, put } from "@vercel/blob";

// Load Vercel env from local file
const envFile = fs.readFileSync(".env.production", "utf-8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.+?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN missing from .env.production");
  process.exit(1);
}

const newEmail = process.argv[2];
if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
  console.error("Usage: node scripts/update-admin-creds.mjs <email>");
  process.exit(1);
}

// Generate a cryptographically strong random password.
// 20 chars from a curated set: letters/digits + a few safe symbols, no
// ambiguous chars (0/O, 1/l/I) so the user can re-type if needed.
function genStrongPassword(length = 20) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_=+";
  const out = [];
  const rnd = crypto.randomBytes(length * 2);
  for (let i = 0; i < length; i++) {
    out.push(chars[rnd[i] % chars.length]);
  }
  return out.join("");
}
const newPassword = genStrongPassword(20);

// 1. Download latest DB
console.log("→ Downloading DB snapshot from Vercel Blob…");
const meta = await head("system/romero.db");
const res = await fetch(meta.url, { cache: "no-store" });
const buf = Buffer.from(await res.arrayBuffer());
const tmpPath = path.join(process.cwd(), ".tmp-admin-update.db");
fs.writeFileSync(tmpPath, buf);
console.log(`  ✓ ${buf.length} bytes downloaded`);

// 2. Open + update
const db = new Database(tmpPath);
db.pragma("journal_mode = DELETE");
const before = db.prepare("SELECT id, email FROM users LIMIT 1").get();
if (!before) {
  console.error("No user found in DB — refusing to proceed");
  process.exit(1);
}
const hash = await bcrypt.hash(newPassword, 10);
db.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = ?").run(
  newEmail.toLowerCase().trim(),
  hash,
  before.id
);
const after = db.prepare("SELECT id, email FROM users WHERE id = ?").get(before.id);
db.close();
console.log(`  ✓ user updated: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);

// 3. Upload back to Blob (overwrites)
console.log("→ Uploading DB back to Vercel Blob…");
const uploaded = fs.readFileSync(tmpPath);
await put("system/romero.db", uploaded, {
  access: "public",
  contentType: "application/x-sqlite3",
  addRandomSuffix: false,
  allowOverwrite: true,
});
console.log(`  ✓ uploaded ${uploaded.length} bytes`);

// 4. Cleanup local file
fs.unlinkSync(tmpPath);

// 5. Print credentials
console.log("\n═════════════════════════════════════════════════════════════════");
console.log("       ✓ ADMIN CREDENTIALS UPDATED IN PRODUCTION");
console.log("═════════════════════════════════════════════════════════════════");
console.log("\n  Email    :  " + newEmail);
console.log("  Password :  " + newPassword);
console.log("\n  Login URL:  https://romerophotography.fr/admin/login");
console.log("\n  ⚠️  STORE THE PASSWORD IN A PASSWORD MANAGER NOW");
console.log("      It will NOT be shown again. The bcrypt hash is one-way.");
console.log("═════════════════════════════════════════════════════════════════\n");
