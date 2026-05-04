"use client";

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * Built on `useSyncExternalStore` so the value is stable across SSR, the
 * hydration render, and any subsequent client renders — avoiding the
 * brief layout flicker that a `useState` + `useEffect` implementation
 * would cause.
 *
 * The server cannot inspect the actual viewport, so callers should pass
 * `ssrDefault` derived from a request-time hint (e.g. the User-Agent
 * header via `getServerViewport()`). Whatever value we return from
 * `getServerSnapshot` is used both during SSR *and* during the first
 * client render (for hydration parity), so a wrong default produces
 * exactly the kind of layout flash this hook is meant to prevent.
 *
 * Tailwind's default breakpoints are `sm: 640`, `md: 768`, `lg: 1024`,
 * `xl: 1280`, `2xl: 1536`. Pair this hook with the matching token, e.g.
 * `useMediaQuery("(min-width: 768px)", ssrIsDesktop)`.
 */
export function useMediaQuery(query: string, ssrDefault = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return ssrDefault;
    return window.matchMedia(query).matches;
  }, [query, ssrDefault]);

  const getServerSnapshot = useCallback(() => ssrDefault, [ssrDefault]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * True when the viewport is at least Tailwind's `md` breakpoint (≥ 768px).
 *
 * Pass `ssrDefault` from a server-side User-Agent check so the initial
 * server-rendered HTML matches the actual device. Without it desktop
 * users would see the mobile layout flash for one frame on every load.
 */
export function useIsDesktop(ssrDefault = false): boolean {
  return useMediaQuery("(min-width: 768px)", ssrDefault);
}
