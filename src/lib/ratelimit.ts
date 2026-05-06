import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Result shape returned to consumers. Mirrors the subset of
 * `@upstash/ratelimit`'s `RatelimitResponse` we actually use.
 */
export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Per-IP cap applied by the middleware to *all* `/api/*` requests. Coarse
 * defense — the per-user limiter below is the one that protects the
 * expensive endpoints.
 */
const IP_REQUESTS_PER_WINDOW = 60;
const IP_WINDOW = "10 s" as const;

/**
 * Per-user cap applied to the streaming chat route. Authenticated traffic
 * gets its own bucket so one bad IP can never starve another user, and so
 * a future misconfigured proxy (no `x-forwarded-for`) can't collapse
 * everyone into the same per-IP bucket and DoS the site.
 */
const USER_REQUESTS_PER_WINDOW = 30;
const USER_WINDOW = "60 s" as const;

/**
 * Lazily-constructed Ratelimit instances, keyed by their identity dimension.
 * We avoid building them at module load because `Redis.fromEnv()` throws
 * synchronously when the Upstash env vars are missing — which would crash
 * the middleware (and therefore every request) just for importing this file.
 *
 * `null` means "config missing — caller decides whether to fail open or
 * closed based on `NODE_ENV`".
 */
type LimiterCache = { ip?: Ratelimit | null; user?: Ratelimit | null };
const cache: LimiterCache = {};

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function getIpLimiter(): Ratelimit | null {
  if (cache.ip !== undefined) return cache.ip;
  const redis = getRedis();
  if (!redis) {
    warnMissingConfig();
    cache.ip = null;
    return null;
  }
  cache.ip = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(IP_REQUESTS_PER_WINDOW, IP_WINDOW),
    analytics: true,
    prefix: "@laude/ratelimit:ip",
  });
  return cache.ip;
}

function getUserLimiter(): Ratelimit | null {
  if (cache.user !== undefined) return cache.user;
  const redis = getRedis();
  if (!redis) {
    warnMissingConfig();
    cache.user = null;
    return null;
  }
  cache.user = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(USER_REQUESTS_PER_WINDOW, USER_WINDOW),
    analytics: true,
    prefix: "@laude/ratelimit:user",
  });
  return cache.user;
}

let warnedAboutMissingConfig = false;
function warnMissingConfig() {
  if (warnedAboutMissingConfig) return;
  warnedAboutMissingConfig = true;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. " +
        "Rate limiting is failing CLOSED in production — requests will be rejected. " +
        "Set both env vars to enable rate limiting properly.",
    );
  }
}

function permissive(reqsPerWindow: number, windowMs: number): RateLimitResult {
  return {
    success: true,
    limit: reqsPerWindow,
    remaining: reqsPerWindow,
    reset: Date.now() + windowMs,
  };
}

function rejected(reqsPerWindow: number, windowMs: number): RateLimitResult {
  return {
    success: false,
    limit: reqsPerWindow,
    remaining: 0,
    reset: Date.now() + windowMs,
  };
}

/**
 * Per-IP rate limit. Used by middleware as a coarse defense against
 * unauthenticated abuse.
 *
 * If Upstash is unconfigured:
 *   - In production → fails CLOSED. Better to break loudly than to silently
 *     run without rate limiting on a public site.
 *   - In development → permissive, with a one-time warning.
 */
export async function limitByIp(ip: string): Promise<RateLimitResult> {
  const limiter = getIpLimiter();
  if (!limiter) {
    return process.env.NODE_ENV === "production"
      ? rejected(IP_REQUESTS_PER_WINDOW, 10_000)
      : permissive(IP_REQUESTS_PER_WINDOW, 10_000);
  }
  const { success, limit, remaining, reset } = await limiter.limit(`ip:${ip}`);
  return { success, limit, remaining, reset };
}

/**
 * Per-user rate limit. Use this in route handlers AFTER `await auth()` so
 * the bucket is keyed on the authenticated user's id, not on a possibly
 * shared/proxied IP. Authenticated abuse costs the abusing user's own
 * quota, never anyone else's.
 *
 * Failure-mode policy is the same as `limitByIp`.
 */
export async function limitByUser(userId: string): Promise<RateLimitResult> {
  const limiter = getUserLimiter();
  if (!limiter) {
    return process.env.NODE_ENV === "production"
      ? rejected(USER_REQUESTS_PER_WINDOW, 60_000)
      : permissive(USER_REQUESTS_PER_WINDOW, 60_000);
  }
  const { success, limit, remaining, reset } = await limiter.limit(
    `user:${userId}`,
  );
  return { success, limit, remaining, reset };
}

/**
 * Extract the client's IP from a request. Returns `null` if no trustworthy
 * forwarded header is present (the request didn't come through a proxy).
 *
 * On Vercel, `x-forwarded-for` and `x-real-ip` are both always set by the
 * platform. If neither is present in production, the request likely
 * bypassed the platform's edge — callers should treat that as a hard error
 * rather than collapsing into a shared `127.0.0.1` bucket (which would
 * make a single misbehaving caller block the whole site).
 *
 * We deliberately use the *leftmost* `x-forwarded-for` entry. On Vercel
 * that's the real client IP; on a multi-hop chain you can flip this to
 * the rightmost trusted hop if you ever introduce another proxy in front.
 */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
