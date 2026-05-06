const MAX_DATA_URL_LENGTH = 32 * 1024 * 1024;

/**
 * Whether the user is currently looking at the design we're about to screenshot. 
 */
export function isVisibleCanvasOnDesign(
  activeTab: string | undefined,
  designId: string,
): boolean {
  if (typeof activeTab !== "string") return false;
  if (typeof designId !== "string" || designId.length === 0) return false;
  return activeTab === `design:${designId}`;
}

/**
 * Validate that a string is a `data:image/png;base64,...` URL with a well-formed body and a sane size cap.
 */
export function isValidPngDataUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const PREFIX = "data:image/png;base64,";
  if (!s.startsWith(PREFIX)) return false;
  if (s.length > MAX_DATA_URL_LENGTH) return false;
  const body = s.slice(PREFIX.length);
  if (body.length === 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(body);
}


/**
 * CSS attribute-selector escape for the design id.
 */
export function cssAttrEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

export function buildScreenshotFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return `Self-critique screenshot ${date} at ${time}.png`;
}
