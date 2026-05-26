/**
 * Vercel Blob persistence for the SQLite DB.
 *
 * Why this exists
 * ---------------
 * Vercel Lambda has a read-only filesystem except for /tmp, which is
 * per-instance and ephemeral (lost on cold start). The shipped seed DB
 * lives at /var/task/data/romero.db (read-only) and the runtime DB at
 * /tmp/romero-data/romero.db. Without external storage, every edit made
 * via /admin would vanish on the next cold start.
 *
 * The workaround: after each write, ship the .db file to Vercel Blob
 * under a stable key. On cold start, before falling back to the seed,
 * try to restore from Blob. End result: edits persist across cold starts
 * and across deployments, no Postgres/Turso migration required.
 *
 * Tradeoffs
 * - Single-writer assumption: this is an admin panel used by one person.
 *   Concurrent admin writes from two devices could lose the loser's last
 *   transaction. Acceptable for this use case.
 * - Each mutation pays ~200-500ms to upload ~110 KB to Blob. Fine for
 *   admin actions, would not be acceptable for hot read paths (which
 *   never call syncDbToBlob anyway).
 */
import fs from "node:fs";
import { put, head } from "@vercel/blob";

const BLOB_DB_KEY = "system/romero.db";
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * If a saved DB exists in Blob, download it and write to `destPath`.
 * Returns true if a Blob copy was restored, false otherwise (caller
 * should then fall back to the bundled seed).
 */
export async function tryRestoreDbFromBlob(destPath: string): Promise<boolean> {
  if (!USE_BLOB) return false;
  try {
    const meta = await head(BLOB_DB_KEY);
    if (!meta || !meta.url) return false;
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    return true;
  } catch {
    // 404 (no saved DB yet) or any other error → caller falls back to seed
    return false;
  }
}

/**
 * Ship the current /tmp/...romero.db to Blob.
 * Call after every write/mutation server action so edits survive cold starts.
 * Silently swallows errors — DB write already succeeded locally, the Blob
 * sync is "best-effort" durability.
 */
export async function syncDbToBlob(srcPath: string): Promise<void> {
  if (!USE_BLOB) return;
  if (!fs.existsSync(srcPath)) return;
  try {
    const buf = fs.readFileSync(srcPath);
    await put(BLOB_DB_KEY, buf, {
      access: "public",
      contentType: "application/x-sqlite3",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch {
    // Best-effort; don't crash the admin action if Blob sync hiccups.
  }
}

/**
 * The on-disk path the DB lives at on this runtime (so callers can pass
 * it to syncDbToBlob without re-importing the db module path constants).
 */
export function runtimeDbPath(): string {
  const path = require("node:path") as typeof import("node:path");
  const IS_SERVERLESS = !!process.env.VERCEL || process.env.NEXT_RUNTIME === "edge";
  const RUNTIME_DB_DIR = IS_SERVERLESS ? "/tmp/romero-data" : path.join(process.cwd(), "data");
  return path.join(RUNTIME_DB_DIR, "romero.db");
}

/**
 * Convenience wrapper: sync the runtime DB to Blob. Call from server
 * actions after any write to persist the change across cold starts.
 * No-op on local dev (no BLOB_READ_WRITE_TOKEN) or if Blob is unavailable.
 */
export async function syncDb(): Promise<void> {
  await syncDbToBlob(runtimeDbPath());
}
