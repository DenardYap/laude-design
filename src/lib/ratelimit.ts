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

const REQUESTS_PER_WINDOW = 60;
const WINDOW = "10 s" as const;

/**
 * Lazily-constructed Ratelimit instance. We avoid building it at module load
 * because `Redis.fromEnv()` throws synchronously when the Upstash env vars are
 * missing — which would crash the middleware (and therefore every request)
 * just for importing this file.
 *
 * `null` means "config missing — rate limiting disabled".
 * `undefined` means "not yet initialized".
 */
let cachedLimiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (cachedLimiter !== undefined) return cachedLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[ratelimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. " +
          "Rate limiting is DISABLED. Set both env vars to enable it.",
      );
    }
    cachedLimiter = null;
    return cachedLimiter;
  }

  cachedLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(REQUESTS_PER_WINDOW, WINDOW),
    analytics: true,
    /**
     * Optional prefix for the keys used in redis. This is useful if you want
     * to share a redis instance with other applications and want to avoid key
     * collisions. The default prefix is "@upstash/ratelimit".
     */
    prefix: "@upstash/ratelimit",
  });
  return cachedLimiter;
}

/**
 * Rate-limit a request by identifier (typically the client IP).
 *
 * If Upstash isn't configured, this resolves to a permissive result so the
 * app keeps working in local dev without Redis. In production, missing config
 * still allows traffic through but logs a warning on first use.
 */
export async function limit(identifier: string): Promise<RateLimitResult> {
  const limiter = getLimiter();
  if (!limiter) {
    return {
      success: true,
      limit: REQUESTS_PER_WINDOW,
      remaining: REQUESTS_PER_WINDOW,
      reset: Date.now() + 10_000,
    };
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return { success, limit, remaining, reset };
}
