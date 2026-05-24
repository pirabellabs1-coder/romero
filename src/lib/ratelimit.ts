/**
 * Simple in-memory sliding-window rate limiter.
 * Works fine for low-traffic, single-region serverless deployments.
 * For multi-region or high traffic, swap for Upstash Redis.
 */

type Bucket = { hits: number[]; lastSweep: number };
const buckets = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 1000;

function sweep(now: number) {
  for (const [key, b] of buckets) {
    if (now - b.lastSweep > SWEEP_INTERVAL_MS) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    // Drop oldest
    const keys = Array.from(buckets.keys()).slice(0, Math.floor(buckets.size / 2));
    for (const k of keys) buckets.delete(k);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { hits: [], lastSweep: now };
    buckets.set(key, b);
  }
  b.lastSweep = now;
  // Drop expired hits
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= max) {
    const oldest = b.hits[0];
    return { ok: false, remaining: 0, resetAt: oldest + windowMs };
  }
  b.hits.push(now);
  if (Math.random() < 0.05) sweep(now);
  return { ok: true, remaining: max - b.hits.length, resetAt: now + windowMs };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}
