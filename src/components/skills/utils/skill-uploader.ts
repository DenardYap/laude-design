export const ACCEPTED_EXTS = [".md", ".mdc", ".markdown", ".txt"] as const;
export const ACCEPTED_ATTR = ACCEPTED_EXTS.join(",");
export const ACCEPTED_LABEL = ".md, .mdc, .markdown, or .txt";
export const STRIP_EXT_RE = /\.(md|mdc|markdown|txt)$/i;
export const MAX_BYTES = 64 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
