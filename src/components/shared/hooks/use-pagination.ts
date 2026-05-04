"use client";

import { useCallback, useEffect, useState } from "react";

import type { UsePaginationResult } from "@/components/shared/types/pagination";

/**
 * Client-side pagination over an in-memory array.
 *
 * Resets to page 1 whenever the underlying item count changes (which happens
 * on filter/sort changes too) so the user is never stranded on an empty
 * page when their previous page falls out of the result set.
 *
 * For server-driven pagination, build a different hook — this one is
 * intentionally narrow.
 */
export function usePagination<T>(items: T[], pageSize: number): UsePaginationResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPageRaw] = useState(1);

  // Reset whenever the dataset shrinks/grows (e.g. filters changed). We watch
  // the count rather than referential equality of `items` — recomputing a
  // filter usually produces a new array even when the result is identical.
  useEffect(() => {
    setPageRaw(1);
  }, [total]);

  const safePage = Math.min(Math.max(1, page), totalPages);

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, Math.floor(next)), totalPages);
      setPageRaw(clamped);
    },
    [totalPages],
  );

  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageItems = items.slice(start, end);

  return {
    page: safePage,
    setPage,
    pageSize,
    total,
    totalPages,
    pageItems,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: end,
  };
}
