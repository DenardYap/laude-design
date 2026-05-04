"use client";

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface UsePaginationResult<T> {
  /** Current 1-indexed page. Clamped to [1, totalPages]. */
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  /** Total number of items across all pages. */
  total: number;
  /** Total number of pages (>= 1, even when total === 0). */
  totalPages: number;
  /** Items belonging to the current page. */
  pageItems: T[];
  /** 1-indexed range of items shown on the current page (e.g. 26–50). */
  rangeStart: number;
  rangeEnd: number;
}

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

interface TablePaginationProps {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Singular noun used in the count label (e.g. "skill" → "5 of 12 skills"). */
  itemLabel?: string;
  className?: string;
}

/**
 * Compact pagination footer shaped to live inside a card-bordered table.
 * Renders nothing when there is only a single page so it doesn't add visual
 * noise to small lists.
 */
export function TablePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
  itemLabel = "item",
  className,
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  const plural = total === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-xs text-ink-muted",
        className,
      )}
    >
      <span>
        Showing <span className="font-medium text-ink">{rangeStart.toLocaleString()}</span>
        –<span className="font-medium text-ink">{rangeEnd.toLocaleString()}</span> of{" "}
        <span className="font-medium text-ink">{total.toLocaleString()}</span> {plural}
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>

        <span className="px-2">
          Page <span className="font-medium text-ink">{page}</span> of{" "}
          <span className="font-medium text-ink">{totalPages}</span>
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
