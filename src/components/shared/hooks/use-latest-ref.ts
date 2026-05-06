"use client";

import { useRef } from "react";

/**
 * Returns a ref that is always up-to-date with the latest value.
 * Assigns synchronously on every render so callbacks that close over the ref
 * always see the current value without needing to re-run effects.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
