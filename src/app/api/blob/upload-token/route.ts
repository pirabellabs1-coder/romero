/**
 * Signed upload token for client-direct → Vercel Blob uploads.
 *
 * Why we need this:
 *   Vercel Serverless Functions cap request bodies at 4.5 MB on Hobby/Pro.
 *   A single wedding photo from a modern camera easily exceeds that, so
 *   funneling uploads through a Server Action silently drops the file at
 *   the edge — the dropzone then flashes "photos ajoutées" while zero
 *   rows hit the DB. The Vercel-recommended fix is to have the browser
 *   upload directly to Blob storage and only round-trip a short token
 *   through us. This endpoint mints that token, gated on admin auth.
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname /* , clientPayload */) => {
        // Re-check auth at token issue time so a stolen cookie can't be used
        // to upload arbitrary files into the photographer's Blob bucket.
        requireUser();

        // Restrict pathnames to the gallery and posts folders. Defence in
        // depth — a logged-in admin can't be tricked into writing outside
        // the namespaces the app uses.
        if (
          !pathname.startsWith("galleries/") &&
          !pathname.startsWith("posts/")
        ) {
          throw new Error("Pathname not allowed");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/heic",
            "image/heif",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024, // 25 MB hard cap, matches MAX_FILE_SIZE_BYTES
          addRandomSuffix: false,
          // No callback — we register the file in our DB after the client
          // upload resolves (see registerUploadedPhotos in galleries/actions.ts).
          tokenPayload: null,
        };
      },
      onUploadCompleted: async (/* { blob, tokenPayload } */) => {
        // No-op — the client calls a Server Action to register the URL.
        // (Vercel calls this from their side after upload, but in local dev
        // it's not reachable without a tunnel — so we don't rely on it.)
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
