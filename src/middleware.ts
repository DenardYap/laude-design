import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientIp, limitByIp } from "@/lib/ratelimit";

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

/**
 * Build a per-request Content-Security-Policy with a random nonce.
 *
 * Two key layers of XSS mitigation:
 *  - `script-src 'nonce-...' 'strict-dynamic'` — injected scripts without the
 *    nonce are blocked at execution time, even if XSS lands in the page.
 *  - `connect-src 'self'` — even if a script does execute, the browser refuses
 *    to POST stolen data (e.g. API keys) to any attacker-controlled origin.
 *
 * The nonce is also forwarded as `x-nonce` so the Next.js App Router can
 * stamp it on every `<script>` tag it emits during SSR.
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
      "https://api.github.com",
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

  // Coarse per-IP rate limit on /api/* as a first line of defense.
  // The expensive endpoints (chat) layer per-USER limiting on top inside
  // their handlers — see `limitByUser` in `src/lib/ratelimit.ts`.
  if (request.nextUrl.pathname.startsWith("/api")) {
    const ip = getClientIp(request.headers);

    // No trustworthy forwarded header. On Vercel this never happens; if it
    // happens in production it means the request bypassed the platform
    // edge or a custom proxy stripped the headers. Failing closed forces
    // the operator to notice + fix proxy config rather than silently
    // funneling every caller into a shared bucket and DoS-ing themselves
    // the next time one bot decides to scrape.
    if (!ip) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Unable to identify client" },
          { status: 400 },
        );
      }
      // Dev: just pass through so localhost / curl / tests aren't blocked.
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      applySecurityHeaders(res, nonce);
      return res;
    }

    const { success, limit, reset, remaining } = await limitByIp(ip);

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
