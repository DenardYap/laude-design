export interface UsePaginationResult<T> {
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

export interface TablePaginationProps {
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
