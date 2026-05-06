export interface UsePaginationResult<T> {
  /** Current 1-indexed page. Clamped to [1, totalPages]. */
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  total: number;
  totalPages: number;
  pageItems: T[];
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
