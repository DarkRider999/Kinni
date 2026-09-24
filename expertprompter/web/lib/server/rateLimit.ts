// Best-effort fixed-window rate limiter. State lives in each serverless
// instance's memory, so limits are per instance, not global. It still stops
// a single client hammering one warm instance. For strict global limits,
// swap in a shared store (e.g. Upstash Redis / Vercel KV).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
