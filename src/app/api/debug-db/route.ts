// TEMPORARY DEBUG ENDPOINT — to remove after diagnosing the persistence issue.
// Reports: what the lambda's _db sees, what Blob head says, and whether the
// restored DB matches the bundled seed (which would mean Blob is empty or the
// previous bug overwrote it with seed state).
import { NextResponse } from "next/server";
import { getDb, getDbAsync, _simulateColdStartForTesting, _internalState } from "@/lib/db";
import { syncDb } from "@/lib/db-persist";
import { requireUser } from "@/lib/auth";
import { head, list } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Protected — only the logged-in photographer can inspect.
  try {
    requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const out: Record<string, unknown> = {};

  // ?forceSync=1 triggers a syncDb() to overwrite Blob with current /tmp content
  // and apply the new cacheControlMaxAge: 60. Use after any deployment that
  // changes cache headers — otherwise the old 30-day cache lingers until the
  // photographer's next admin write.
  if (url.searchParams.get("forceSync") === "1") {
    try {
      await getDbAsync(); // make sure /tmp is initialized with current Blob state
      await syncDb();
      out.forceSync = "ok";
    } catch (e) {
      out.forceSync = e instanceof Error ? e.message : String(e);
    }
  }

  // ?selfTest=1 runs the full persistence cycle: write a unique marker to
  // settings, sync to Blob, simulate a cold lambda (tear down _db + /tmp),
  // re-read via the public read path (getDb sync, same as portfolio pages),
  // verify the marker survived, then clean up. This is the exact scenario
  // that was broken before the getDbAsync fix: writes were applied on top
  // of a fresh seed copy and pushed to Blob, wiping all prior state.
  if (url.searchParams.get("selfTest") === "1") {
    const steps: Record<string, unknown>[] = [];
    const TEST_KEY = "_verify_marker";
    const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      // Step 1 — write the marker through the same path admin actions use.
      const writeDb = await getDbAsync();
      writeDb
        .prepare(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .run(TEST_KEY, marker);
      await syncDb();
      steps.push({
        step: 1,
        action: "write+sync",
        marker,
        state: _internalState(),
      });

      // Step 2 — read back from the SAME lambda (warm path).
      const warmRead = (writeDb.prepare("SELECT value FROM settings WHERE key = ?").get(TEST_KEY) as { value: string } | undefined)?.value;
      steps.push({
        step: 2,
        action: "warm-read (same lambda)",
        readValue: warmRead,
        matches: warmRead === marker,
      });

      // Step 3 — simulate a cold lambda by tearing down the in-memory handle
      // AND /tmp. Next read MUST come from Blob.
      _simulateColdStartForTesting();
      steps.push({
        step: 3,
        action: "simulate cold start",
        state: _internalState(),
      });

      // Step 4 — restore + read via getDbAsync (what the layout does on a
      // fresh lambda).
      const coldDb = await getDbAsync();
      const coldRead = (coldDb.prepare("SELECT value FROM settings WHERE key = ?").get(TEST_KEY) as { value: string } | undefined)?.value;
      steps.push({
        step: 4,
        action: "cold-read via getDbAsync (restored from Blob)",
        readValue: coldRead,
        matches: coldRead === marker,
        state: _internalState(),
      });

      // Step 5 — read via getDb() sync (the public portfolio read path).
      const syncRead = (getDb().prepare("SELECT value FROM settings WHERE key = ?").get(TEST_KEY) as { value: string } | undefined)?.value;
      steps.push({
        step: 5,
        action: "sync-read via getDb (same path public portfolio uses)",
        readValue: syncRead,
        matches: syncRead === marker,
      });

      // Step 6 — clean up the test marker.
      coldDb.prepare("DELETE FROM settings WHERE key = ?").run(TEST_KEY);
      await syncDb();
      steps.push({
        step: 6,
        action: "cleanup + final sync",
      });

      const allPassed =
        steps[1] && (steps[1] as { matches?: boolean }).matches === true &&
        steps[3] && (steps[3] as { matches?: boolean }).matches === true &&
        steps[4] && (steps[4] as { matches?: boolean }).matches === true;

      out.selfTest = {
        verdict: allPassed ? "PASS ✅ persistence works across cold starts" : "FAIL ❌ marker lost somewhere — see steps",
        marker,
        steps,
      };
    } catch (e) {
      out.selfTest = {
        verdict: "ERROR",
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        steps,
      };
    }
  }

  // 1. What does Blob head say?
  try {
    const meta = await head("system/romero.db");
    out.blobHead = {
      url: meta?.url,
      size: meta?.size,
      uploadedAt: meta?.uploadedAt,
      contentType: meta?.contentType,
      cacheControl: meta?.cacheControl,
    };
  } catch (e) {
    out.blobHeadError = e instanceof Error ? e.message : String(e);
  }

  // 2. What does the lambda's DB currently contain?
  try {
    const db = await getDbAsync();
    const galleries = db
      .prepare("SELECT id, slug, names, cover_photo_id FROM galleries ORDER BY id")
      .all();
    const photosByGallery = db
      .prepare(
        "SELECT gallery_id, COUNT(*) as c, MIN(filename) as first FROM photos GROUP BY gallery_id"
      )
      .all();
    out.dbState = { galleries, photosByGallery };
  } catch (e) {
    out.dbError = e instanceof Error ? e.message : String(e);
  }

  // 3. What's on disk in /tmp?
  try {
    const tmpDb = "/tmp/romero-data/romero.db";
    if (fs.existsSync(tmpDb)) {
      const buf = fs.readFileSync(tmpDb);
      out.tmpDb = {
        exists: true,
        size: buf.length,
        sha256: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16),
      };
    } else {
      out.tmpDb = { exists: false };
    }
  } catch (e) {
    out.tmpDbError = e instanceof Error ? e.message : String(e);
  }

  // 4. What's the seed bundle on disk?
  try {
    const seedDb = path.join(process.cwd(), "data", "romero.db");
    if (fs.existsSync(seedDb)) {
      const buf = fs.readFileSync(seedDb);
      out.seedDb = {
        exists: true,
        size: buf.length,
        sha256: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16),
      };
    } else {
      out.seedDb = { exists: false };
    }
  } catch (e) {
    out.seedDbError = e instanceof Error ? e.message : String(e);
  }

  // 4b. What photo files are in Blob?
  try {
    const all = await list({ prefix: "galleries/", limit: 500 });
    const grouped: Record<string, { count: number; first: string }> = {};
    for (const b of all.blobs) {
      const parts = b.pathname.split("/");
      const folder = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
      if (!grouped[folder]) grouped[folder] = { count: 0, first: b.pathname };
      grouped[folder].count++;
    }
    out.blobPhotos = { totalBlobs: all.blobs.length, byFolder: grouped, hasMore: all.hasMore };
  } catch (e) {
    out.blobPhotosError = e instanceof Error ? e.message : String(e);
  }

  // 4c. Per-gallery photo detail from the DB
  try {
    const db = await getDbAsync();
    const perGallery: Record<string, unknown> = {};
    for (const g of (db.prepare("SELECT id, slug FROM galleries").all() as { id: number; slug: string }[])) {
      const photos = db
        .prepare("SELECT id, filename FROM photos WHERE gallery_id = ? ORDER BY sort_order, id")
        .all(g.id) as { id: number; filename: string }[];
      perGallery[g.slug] = { id: g.id, count: photos.length, photos: photos.slice(0, 3) };
    }
    out.perGalleryDetail = perGallery;
  } catch (e) {
    out.perGalleryError = e instanceof Error ? e.message : String(e);
  }

  // 5. Env diagnostics
  out.env = {
    hasBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    isVercel: Boolean(process.env.VERCEL),
    region: process.env.VERCEL_REGION,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  };

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
