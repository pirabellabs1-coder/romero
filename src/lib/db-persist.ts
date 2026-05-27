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
 *
 * Note: Vercel Blob serves files via a CDN that aggressively caches.
 * Even with `cache: "no-store"` on the fetch, the edge cache may still
 * return a stale copy. We append the blob's own uploadedAt timestamp
 * as a query parameter so each new version has a unique URL — the CDN
 * treats it as a cache miss and fetches fresh from origin.
 */
export async function tryRestoreDbFromBlob(destPath: string): Promise<boolean> {
  if (!USE_BLOB) return false;
  try {
    const meta = await head(BLOB_DB_KEY);
    if (!meta || !meta.url) return false;
    const ts = meta.uploadedAt ? new Date(meta.uploadedAt).getTime() : Date.now();
    const url = meta.url.includes("?") ? `${meta.url}&v=${ts}` : `${meta.url}?v=${ts}`;
    const res = await fetch(url, { cache: "no-store" });
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
 * Get the Blob's last-modified timestamp (ms since epoch) without
 * downloading the file. Used to detect whether another lambda has
 * pushed a newer snapshot than what we have locally. Returns null on
 * error or if no Blob copy exists yet.
 *
 * Cost: ~50ms HEAD request. Acceptable on every public page request.
 */
export async function getBlobDbLastModifiedMs(): Promise<number | null> {
  if (!USE_BLOB) return null;
  try {
    const meta = await head(BLOB_DB_KEY);
    if (!meta || !meta.uploadedAt) return null;
    return new Date(meta.uploadedAt).getTime();
  } catch {
    return null;
  }
}

/**
 * Ship the current /tmp/...romero.db to Blob.
 * Call after every write/mutation server action so edits survive cold starts.
 * Silently swallows errors — DB write already succeeded locally, the Blob
 * sync is "best-effort" durability.
 *
 * `cacheControlMaxAge: 60` is the minimum Vercel Blob accepts. Default of
 * one month is unacceptable here: the same path is overwritten on every
 * admin edit, and a stale CDN response would clobber a freshly-written
 * local DB the next time a freshness check fires in db.ts.
 *
 * Returns the upload timestamp (ms since epoch) on success, or null on
 * failure / when Blob is not configured. Callers in db.ts use this to
 * bump the in-memory "we have the latest" marker so the next freshness
 * check on the same lambda doesn't re-download the file we just wrote.
 */
export async function syncDbToBlob(srcPath: string): Promise<number | null> {
  if (!USE_BLOB) return null;
  if (!fs.existsSync(srcPath)) return null;
  try {
    const buf = fs.readFileSync(srcPath);
    await put(BLOB_DB_KEY, buf, {
      access: "public",
      contentType: "application/x-sqlite3",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    return Date.now();
  } catch {
    // Best-effort; don't crash the admin action if Blob sync hiccups.
    return null;
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
 *
 * On success, hands the upload timestamp to db.ts so its in-memory
 * freshness marker matches what we just put in Blob. Without that hand-off
 * the next freshness check on this lambda would see Blob's new timestamp,
 * decide our local copy is stale, and re-download — pulling whatever the
 * CDN happens to be serving (which can be the previous version for up to
 * `cacheControlMaxAge` seconds), silently reverting the write.
 *
 * Dynamic import breaks the otherwise-circular db.ts ↔ db-persist.ts edge.
 */
export async function syncDb(): Promise<void> {
  const uploadedAt = await syncDbToBlob(runtimeDbPath());
  if (uploadedAt != null) {
    const { markDbSyncedAt } = await import("@/lib/db");
    markDbSyncedAt(uploadedAt);
  }
}
