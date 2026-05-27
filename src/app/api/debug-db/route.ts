// TEMPORARY DEBUG ENDPOINT — to remove after diagnosing the persistence issue.
// Reports: what the lambda's _db sees, what Blob head says, and whether the
// restored DB matches the bundled seed (which would mean Blob is empty or the
// previous bug overwrote it with seed state).
import { NextResponse } from "next/server";
import { getDbAsync } from "@/lib/db";
import { head } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {};

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

  // 5. Env diagnostics
  out.env = {
    hasBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    isVercel: Boolean(process.env.VERCEL),
    region: process.env.VERCEL_REGION,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
  };

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
