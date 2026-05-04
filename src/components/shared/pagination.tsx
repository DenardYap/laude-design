"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { TablePaginationProps } from "@/components/shared/types/pagination";

export type { UsePaginationResult } from "@/components/shared/types/pagination";
export { usePagination } from "@/components/shared/hooks/use-pagination";

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
