/**
 * Browser-side helper to push a File to Supabase Storage via the
 * signed-URL flow.
 *
 * Flow:
 *   1. POST /api/blob/upload-token with the desired pathname.
 *      Server checks auth, validates the prefix, and returns a single-use
 *      signed URL.
 *   2. PUT the file straight at that signed URL with the file's MIME
 *      type. Supabase Storage stores it under the agreed path.
 *   3. Return the public CDN URL — caller registers it in the DB via a
 *      Server Action.
 *
 * Keeps large photos out of Vercel's 4.5 MB serverless body cap (same
 * reason we needed the Blob token route before) without pulling
 * @supabase/supabase-js into the client bundle.
 */

export type StorageUploadResult = {
  path: string;
  publicUrl: string;
};

export async function uploadToStorage(
  pathname: string,
  file: File
): Promise<StorageUploadResult> {
  // 1. Mint a signed URL
  const tokenRes = await fetch("/api/blob/upload-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pathname, contentType: file.type }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({ error: tokenRes.statusText }));
    throw new Error(`Token: ${err.error || tokenRes.statusText}`);
  }
  const { signedUrl, path, publicUrl } = (await tokenRes.json()) as {
    signedUrl: string;
    path: string;
    publicUrl: string;
    token: string;
  };

  // 2. Direct PUT to Supabase. Supabase's signed upload URL expects the
  //    raw file body — no multipart wrapper, content-type matches the file.
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
      "cache-control": "max-age=31536000",
    },
    body: file,
  });
  if (!putRes.ok) {
    const txt = await putRes.text().catch(() => putRes.statusText);
    throw new Error(`Upload (${putRes.status}): ${txt.slice(0, 200)}`);
  }

  return { path, publicUrl };
}
