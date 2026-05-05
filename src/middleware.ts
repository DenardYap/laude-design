import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { limit as rateLimit } from "@/lib/ratelimit";

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

/**
 * Build a per-request Content-Security-Policy with a random nonce so
 * `script-src 'strict-dynamic'` allows only Next.js's own inline scripts.
 *
 * The nonce is also forwarded as `x-nonce` so the Next.js App Router can
 * stamp it on every `<script>` tag it emits during SSR.
 *
 * Key directives for localStorage protection:
 *  - `connect-src 'self' ...` — even if XSS lands, the browser refuses to
 *    POST the user's API key to any attacker-controlled origin.
 *  - `script-src 'nonce-...' 'strict-dynamic'` — injected scripts that don't
 *    carry the nonce are blocked at execution time.
 */
function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // 'unsafe-inline' is required for Tailwind CSS-in-JS style tags at runtime.
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data: blob:",
      "https://lh3.googleusercontent.com",
      "https://avatars.githubusercontent.com",
      "https://*.public.blob.vercel-storage.com",
    ].join(" "),
    [
      "connect-src 'self'",
      "https://*.public.blob.vercel-storage.com",
    ].join(" "),
    // Sandpack preview iframes live on csb.app and versioned bundler
    // subdomains of codesandbox.io (e.g. 2-19-8-sandpack.codesandbox.io).
    "frame-src https://codesandbox.io https://*.codesandbox.io https://*.csb.app",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Prevents this app from being embedded in iframes elsewhere (clickjacking).
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

function applySecurityHeaders(response: NextResponse, nonce: string): void {
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Forward the nonce to RSC / layout so Next can stamp it on script tags.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Apply rate limiting to API routes.
  if (request.nextUrl.pathname.startsWith("/api")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "127.0.0.1";
    const { success, limit, reset, remaining } = await rateLimit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("X-RateLimit-Limit", limit.toString());
    res.headers.set("X-RateLimit-Remaining", remaining.toString());
    res.headers.set("X-RateLimit-Reset", reset.toString());
    applySecurityHeaders(res, nonce);
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(res, nonce);
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
