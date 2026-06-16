/**
 * Photo storage backend — Supabase Storage.
 *
 * Replaces the previous Vercel Blob integration. Same external API
 * shape (signed upload tokens for client-direct uploads to bypass
 * Vercel's 4.5MB serverless body limit, public URLs for serving)
 * but backed by Supabase Storage. Same provider as our Postgres
 * database — one less third-party to monitor.
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL       — e.g. https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY      — secret, server-side only
 *
 * Bucket: "photos" (public, 50 MB max per file). Created via
 * scripts/setup-supabase-storage.sql.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "photos";

let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error(
      "Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Return the public CDN URL for an object at `path` inside the photos bucket.
 * Used by the admin to display existing photos and by the public site to
 * serve them.
 */
export function publicPhotoUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Generate a signed upload URL so the browser can PUT the file straight
 * to Supabase Storage. Mirrors the pattern we used with Vercel Blob —
 * keeps large uploads out of the Vercel serverless function body limit.
 *
 * Returns the path the client should use + a token to authorise the
 * single-use upload. Public URL is publicPhotoUrl(path) after success.
 */
export async function createSignedPhotoUpload(filename: string, prefix = ""): Promise<{
  path: string;
  signedUrl: string;
  token: string;
  publicUrl: string;
}> {
  const safe = sanitizeFilename(filename);
  const key = prefix ? `${prefix}/${safe}` : safe;
  const { data, error } = await getClient().storage
    .from(BUCKET)
    .createSignedUploadUrl(key);
  if (error || !data) throw new Error(error?.message || "createSignedUploadUrl failed");
  return {
    path: key,
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: publicPhotoUrl(key),
  };
}

/**
 * Server-side upload (fallback for small files or when we already have the
 * bytes in memory — e.g. from a server action). Returns the public URL.
 */
export async function uploadPhotoServer(
  path: string,
  body: Buffer | Blob | ArrayBuffer,
  contentType: string
): Promise<string> {
  const safe = path.split("/").map(sanitizeFilename).join("/");
  const { error } = await getClient().storage
    .from(BUCKET)
    .upload(safe, body as Blob, { contentType, upsert: true });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return publicPhotoUrl(safe);
}

/** Remove an object. Pass the path you stored on the photos table. */
export async function deletePhoto(path: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

/**
 * If we keep a stored `filename` column in the photos table, this turns
 * whatever we kept (full URL, supabase path, legacy /uploads/ path, etc.)
 * into a public URL the browser can fetch.
 *
 * Legacy compatibility for the Vercel Blob URLs already in the DB —
 * those just pass through.
 */
export function resolvePhotoUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  // Treat as a path inside the photos bucket.
  if (stored.startsWith("galleries/") || stored.startsWith("content/")) {
    return publicPhotoUrl(stored);
  }
  // Legacy seed photos in /public/uploads.
  return `/uploads/${stored}`;
}

/**
 * Strip dangerous filename characters; keep extension. Uploaded paths
 * become predictable bucket keys with no surprises.
 */
function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const cleanBase = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "photo";
  const cleanExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 8);
  return `${cleanBase}${cleanExt}`;
}
