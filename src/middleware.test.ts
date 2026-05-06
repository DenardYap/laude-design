import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ratelimit", () => ({
  getClientIp: vi.fn(),
  limitByIp: vi.fn(),
}));

import { middleware } from "./middleware";
import { getClientIp, limitByIp } from "@/lib/ratelimit";

const mockGetClientIp = vi.mocked(getClientIp);
const mockLimitByIp = vi.mocked(limitByIp);

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://example.com${path}`, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const ALLOWED = { success: true as const, limit: 60, remaining: 59, reset: 9_999_999 };
const BLOCKED = { success: false as const, limit: 60, remaining: 0, reset: 9_999_999 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNonce(csp: string): string | undefined {
  return csp.match(/'nonce-([^']+)'/)?.[1];
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

describe("security headers", () => {
  it("sets Content-Security-Policy on every non-API response", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("sets Strict-Transport-Security with a 2-year max-age", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("Strict-Transport-Security")).toMatch(
      /max-age=63072000/,
    );
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options: DENY", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets Referrer-Policy: strict-origin-when-cross-origin", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("sets Permissions-Policy disabling camera, microphone, and geolocation", async () => {
    const res = await middleware(makeRequest("/"));
    const policy = res.headers.get("Permissions-Policy")!;
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });
});

// ---------------------------------------------------------------------------
// CSP nonce
// ---------------------------------------------------------------------------

describe("CSP nonce", () => {
  it("embeds a nonce in script-src", async () => {
    const res = await middleware(makeRequest("/"));
    const csp = res.headers.get("Content-Security-Policy")!;
    expect(getNonce(csp)).toBeTruthy();
  });

  it("nonce is a valid base64 string", async () => {
    const res = await middleware(makeRequest("/"));
    const nonce = getNonce(res.headers.get("Content-Security-Policy")!)!;
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("generates a unique nonce per request", async () => {
    const [res1, res2] = await Promise.all([
      middleware(makeRequest("/")),
      middleware(makeRequest("/")),
    ]);
    const nonce1 = getNonce(res1.headers.get("Content-Security-Policy")!);
    const nonce2 = getNonce(res2.headers.get("Content-Security-Policy")!);
    expect(nonce1).not.toBe(nonce2);
  });

  it("uses strict-dynamic alongside the nonce in script-src", async () => {
    const res = await middleware(makeRequest("/"));
    const csp = res.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("'strict-dynamic'");
  });

  it("includes frame-ancestors 'none' to block clickjacking", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  // NOTE: CSP enforcement itself is browser-side — the server only emits the
  // header. The two tests below verify the structural properties that make
  // nonce enforcement meaningful. Full "script is actually blocked" coverage
  // requires a real browser test (e.g. Playwright).

  it("script-src does not contain 'unsafe-inline', so the nonce is the only way in", async () => {
    const res = await middleware(makeRequest("/"));
    const csp = res.headers.get("Content-Security-Policy")!;
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("a nonce from a prior request is absent from the current CSP, so stale scripts would be rejected", async () => {
    const res1 = await middleware(makeRequest("/"));
    const res2 = await middleware(makeRequest("/"));

    const staleNonce = getNonce(res1.headers.get("Content-Security-Policy")!)!;
    const currentCsp = res2.headers.get("Content-Security-Policy")!;
    const currentNonce = getNonce(currentCsp)!;

    // The current policy contains only the fresh nonce.
    expect(currentCsp).toContain(`'nonce-${currentNonce}'`);
    // A script carrying the stale nonce would not match any allowed source.
    expect(currentCsp).not.toContain(`nonce-${staleNonce}`);
  });
});

// ---------------------------------------------------------------------------
// API rate limiting — allowed requests
// ---------------------------------------------------------------------------

describe("API rate limiting — allowed", () => {
  beforeEach(() => {
    mockGetClientIp.mockReturnValue("1.2.3.4");
    mockLimitByIp.mockResolvedValue(ALLOWED);
  });

  it("passes through with status 200", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.status).toBe(200);
  });

  it("attaches X-RateLimit-Limit header", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
  });

  it("attaches X-RateLimit-Remaining header", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("59");
  });

  it("attaches X-RateLimit-Reset header", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.headers.get("X-RateLimit-Reset")).toBe("9999999");
  });

  it("still applies security headers on allowed API responses", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("calls limitByIp with the extracted IP", async () => {
    await middleware(makeRequest("/api/test"));
    expect(mockLimitByIp).toHaveBeenCalledWith("1.2.3.4");
  });
});

// ---------------------------------------------------------------------------
// API rate limiting — blocked requests
// ---------------------------------------------------------------------------

describe("API rate limiting — blocked", () => {
  beforeEach(() => {
    mockGetClientIp.mockReturnValue("1.2.3.4");
    mockLimitByIp.mockResolvedValue(BLOCKED);
  });

  it("returns 429", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.status).toBe(429);
  });

  it("returns a JSON body with error message", async () => {
    const res = await middleware(makeRequest("/api/test"));
    const body = await res.json();
    expect(body.error).toMatch(/too many requests/i);
  });

  it("attaches X-RateLimit-Limit header", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
  });

  it("attaches X-RateLimit-Remaining: 0", async () => {
    const res = await middleware(makeRequest("/api/test"));
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// API rate limiting — unresolvable IP
// ---------------------------------------------------------------------------

describe("API rate limiting — no client IP", () => {
  beforeEach(() => {
    mockGetClientIp.mockReturnValue(null);
  });

  it("returns 400 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await middleware(makeRequest("/api/test"));
    expect(res.status).toBe(400);
  });

  it("returns a JSON body explaining the error in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await middleware(makeRequest("/api/test"));
    const body = await res.json();
    expect(body.error).toMatch(/identify client/i);
  });

  it("does not call limitByIp in production when IP is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockGetClientIp.mockReturnValue(null);
    await middleware(makeRequest("/api/test"));
    expect(mockLimitByIp).not.toHaveBeenCalled();
  });

  it("passes through in development when IP is missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockGetClientIp.mockReturnValue(null);
    const res = await middleware(makeRequest("/api/test"));
    expect(res.status).toBe(200);
  });

  it("still applies security headers in development pass-through", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockGetClientIp.mockReturnValue(null);
    const res = await middleware(makeRequest("/api/test"));
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// Non-API routes
// ---------------------------------------------------------------------------

describe("non-API routes", () => {
  it("does not invoke rate limiting", async () => {
    await middleware(makeRequest("/dashboard"));
    expect(mockGetClientIp).not.toHaveBeenCalled();
    expect(mockLimitByIp).not.toHaveBeenCalled();
  });

  it("returns 200", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(200);
  });

  it("applies security headers on page routes", async () => {
    const res = await middleware(makeRequest("/settings"));
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("applies security headers on the root route", async () => {
    const res = await middleware(makeRequest("/"));
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });
});
