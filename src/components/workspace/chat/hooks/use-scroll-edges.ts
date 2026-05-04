"use client";

import { useEffect, useState } from 'react';
import type { DependencyList, RefObject } from 'react';
/**
 * Tracks whether a scrollable element has hidden content to the left or right.
 * Returns `{ left, right }` booleans toggled on scroll and resize events.
 * Pass the deps array to re-run the effect when the content length changes
 * (e.g. the number of tabs).
 */
export function useScrollEdges(
  ref: RefObject<HTMLElement | null>,
  deps: DependencyList,
): { left: boolean; right: boolean } {
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right },
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);

  return edges;
}
