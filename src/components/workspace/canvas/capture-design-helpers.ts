/**
 * Pure helpers extracted from `capture-design.ts` so the security- and
 * correctness-sensitive logic can be exercised in unit tests without a
 * jsdom environment. The orchestrator itself is unavoidably async + DOM-
 * heavy, but every branching decision lives here as a plain function.
 */

/**
 * Whether the user is currently looking at the design we're about to
 * screenshot. Matches the format that `useWorkspaceStore` uses for
 * `activeTabByProject`: `"files"` for the file tree, `"design:<id>"`
 * for an open design.
 *
 * Used by the orchestrator to choose between the visible-iframe fast
 * path (zero overhead — the iframe is already hot) and the hidden-host
 * fallback (cold-mount a separate Sandpack off-screen).
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
 * Validate that a string is a `data:image/png;base64,...` URL with a
 * well-formed body and a sane size cap. Re-exported here in addition to
 * the copy in `screenshot-upload.ts` because the orchestrator runs on
 * the client and we deliberately keep the client bundle off Node-only
 * imports.
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

const MAX_DATA_URL_LENGTH = 32 * 1024 * 1024;

/**
 * CSS attribute-selector escape for the design id. UUIDs are already safe,
 * but a previously-imported design with an unusual id shouldn't be allowed
 * to break (or escape) the selector.
 *
 * Only `"` and `\` need escaping inside `[attr="..."]` selectors per
 * CSSOM-Selectors-Level-4 § 9.7.
 */
export function cssAttrEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * Build a deterministic, human-friendly filename for a self-critique
 * screenshot. Timestamp uses local time so the filename matches what the
 * user would expect from the timestamp on the upload row.
 */
export function buildScreenshotFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return `Self-critique screenshot ${date} at ${time}.png`;
}
