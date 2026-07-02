type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; remaining: number };

export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count };
}

import { env } from "./env";

// X-Forwarded-For / X-Real-IP are client-supplied and only meaningful behind a
// trusted proxy. When TRUST_PROXY is off we ignore them and return a shared key,
// so IP-keyed rate limits degrade to a single global bucket per endpoint instead
// of being trivially bypassable by rotating the header.
export function getClientIp(headers: Headers): string {
  if (!env.TRUST_PROXY) return "shared";

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "127.0.0.1";
}
