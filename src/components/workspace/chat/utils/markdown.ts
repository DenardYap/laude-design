// Explicit URL allowlist — pinning it here makes the protection visible in
// code review and survives future plugin changes that might re-enable raw HTML
// or relax URL filtering.
const ALLOWED_URL_SCHEMES = /^(https?:|mailto:|tel:)/i;

export function urlTransform(url: string): string {
  if (ALLOWED_URL_SCHEMES.test(url)) return url;
  return "";
}
