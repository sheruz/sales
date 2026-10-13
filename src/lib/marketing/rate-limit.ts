import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = { success: boolean; remaining: number };

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number
): LimitResult {
  const now = Date.now();
  const row = memoryBuckets.get(key);
  if (!row || now > row.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (row.count >= limit) return { success: false, remaining: 0 };
  row.count += 1;
  return { success: true, remaining: limit - row.count };
}

let upstash: Ratelimit | null = null;
let warned = false;

function getUpstash(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned && process.env.NODE_ENV !== "production") {
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN missing — using in-memory limiter (dev only)"
      );
      warned = true;
    }
    return null;
  }
  if (!upstash) {
    upstash = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(8, "10 m"),
      prefix: "delvix-marketing",
    });
  }
  return upstash;
}

export async function limitFormIp(ip: string): Promise<LimitResult> {
  const limiter = getUpstash();
  if (!limiter) return memoryLimit(`form:${ip}`, 8, 10 * 60 * 1000);
  const res = await limiter.limit(`form:${ip}`);
  return { success: res.success, remaining: res.remaining };
}

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
