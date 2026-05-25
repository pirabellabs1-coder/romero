/**
 * Pure helper to resolve a stored photo filename to a usable URL.
 * Lives in its own module (no DB / fs imports) so it can be imported
 * from client components.
 *
 * - Empty/null/undefined → null
 * - Full URL (http:// or https://) → returned as-is (e.g. Vercel Blob)
 * - Relative path → prefixed with /uploads/ (local seed photo)
 */
export function photoUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  if (filename.startsWith("http://") || filename.startsWith("https://")) return filename;
  return `/uploads/${filename}`;
}
