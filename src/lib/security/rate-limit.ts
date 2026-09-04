import { env } from "@/lib/config/env";
import { AppError } from "@/lib/api/response";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

/**
 * Fixed-window rate limiter (in-memory). Use Redis in multi-instance production.
 */
export function assertRateLimit(
  key: string,
  opts?: { max?: number; windowMs?: number }
): void {
  const max = opts?.max ?? env.RATE_LIMIT_MAX;
  const windowMs = opts?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= max) {
    throw new AppError("Too many requests. Please try again later.", 429, "RATE_LIMITED");
  }
  existing.count += 1;
}

/** Stricter limits for auth endpoints */
export function assertAuthRateLimit(ip: string, email?: string) {
  assertRateLimit(`auth:ip:${ip}`, { max: 30, windowMs: 60_000 });
  if (email) {
    assertRateLimit(`auth:email:${email.toLowerCase()}`, {
      max: 10,
      windowMs: 60_000,
    });
  }
}

export function clearRateLimitBucketsForTests() {
  buckets.clear();
}
