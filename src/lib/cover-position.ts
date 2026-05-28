/**
 * Validation helper for object-position values stored as cover_position.
 *
 * Accepted formats:
 *   • Named CSS positions: "left top", "center top", "right top",
 *     "left center", "center center", "right center", "left bottom",
 *     "center bottom", "right bottom".
 *   • Percentage pair: "42% 67%" (x then y, 0–100 each).
 *
 * Anything else falls back to "center center". Defence-in-depth against
 * an admin pasting arbitrary CSS into a live-save endpoint.
 */
const NAMED_POS = new Set([
  "left top", "center top", "right top",
  "left center", "center center", "right center",
  "left bottom", "center bottom", "right bottom",
]);

export function sanitizePosition(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (NAMED_POS.has(s)) return s;
  const m = s.match(/^(-?\d{1,3}(?:\.\d+)?)%\s+(-?\d{1,3}(?:\.\d+)?)%$/);
  if (m) {
    const x = Math.max(0, Math.min(100, parseFloat(m[1])));
    const y = Math.max(0, Math.min(100, parseFloat(m[2])));
    return `${x}% ${y}%`;
  }
  return "center center";
}
