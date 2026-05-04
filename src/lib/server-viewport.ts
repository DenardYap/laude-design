import { headers } from "next/headers";

/**
 * Server-side guess at whether the request is coming from a desktop-class
 * device, used to pick a sensible SSR default for `useIsDesktop`.
 *
 * The actual viewport width is the source of truth on the client — this
 * is only a hint so the server-rendered HTML matches the device's first
 * paint and we don't show the mobile layout for a frame on desktop loads.
 *
 * Detection order:
 *  1. `Sec-CH-UA-Mobile` (Client Hints) — the most accurate signal when
 *     the browser sends it (Chromium-based browsers do).
 *  2. User-Agent sniffing — covers Safari/Firefox and proxies that strip
 *     Client Hints. Modern iPad Safari masquerades as Mac, which means
 *     iPads correctly resolve to "desktop" here, matching their typical
 *     viewport width.
 *
 * If we have no signal at all (no UA header, e.g. some healthchecks),
 * we default to desktop because that's the more common case and the
 * client will correct anything wrong on the very next render.
 */
export async function isDesktopUserAgent(): Promise<boolean> {
  const h = await headers();

  const chMobile = h.get("sec-ch-ua-mobile");
  if (chMobile === "?1") return false;
  if (chMobile === "?0") return true;

  const ua = h.get("user-agent") ?? "";
  if (!ua) return true;

  return !/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(
    ua,
  );
}
