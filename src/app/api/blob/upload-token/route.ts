/**
 * Signed upload URL for client-direct → Supabase Storage uploads.
 *
 * Same purpose as the previous Vercel Blob endpoint: Vercel Serverless
 * Functions cap request bodies at 4.5 MB on Hobby/Pro, so wedding photos
 * straight from a modern camera silently drop at the edge. Solution: the
 * browser POSTs the file straight to Supabase Storage using a short-lived
 * signed URL we mint here, gated on admin auth.
 *
 * Endpoint kept at /api/blob/upload-token for backwards compatibility
 * with the existing client uploaders — only the response shape changed
 * (now { signedUrl, token, path, publicUrl } instead of Vercel's
 * { url, type, payload } envelope).
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSignedPhotoUpload } from "@/lib/storage";

export const runtime = "nodejs";

type Body = {
  /** Bucket-relative path (e.g. "galleries/g1/<filename>"). */
  pathname?: string;
  contentType?: string;
};

const ALLOWED_PREFIXES = ["galleries/", "posts/", "content/", "uploads/"];

export async function POST(req: Request): Promise<Response> {
  try {
    requireUser();
    const body = (await req.json().catch(() => ({}))) as Body;
    const pathname = String(body.pathname || "").replace(/^\/+/, "");
    if (!pathname) {
      return NextResponse.json({ error: "Missing pathname" }, { status: 400 });
    }
    if (!ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.json({ error: "Pathname not allowed" }, { status: 400 });
    }
    // Split into folder/file so the bucket key keeps its hierarchy and the
    // filename gets sanitised separately.
    const lastSlash = pathname.lastIndexOf("/");
    const prefix = lastSlash >= 0 ? pathname.slice(0, lastSlash) : "";
    const filename = lastSlash >= 0 ? pathname.slice(lastSlash + 1) : pathname;
    const result = await createSignedPhotoUpload(filename, prefix);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
