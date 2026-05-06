export interface DesignFileLintError {
  /** Stable code so callers can branch (and prompts can reference it). */
  code:
    | "syntax"
    | "missing-default-export"
    | "disallowed-import"
    | "invalid-extension";
  message: string;
  /** 1-indexed; only present for parser diagnostics. */
  line?: number;
  /** 1-indexed; only present for parser diagnostics. */
  column?: number;
}
