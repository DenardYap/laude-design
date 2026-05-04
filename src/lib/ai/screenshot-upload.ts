import { resolveBlobUrl } from "./inline-attachments";

/**
 * Fetch a screenshot upload from Vercel Blob for inclusion in a model
 * message. Returns base64 PNG bytes, or `null` if anything is off —
 * callers surface a generic error to the model in that case.
 *
 * Hardened against four classes of attack:
 *
 *   1. **Cross-tenant access / SSRF.** Delegated to `resolveBlobUrl`
 *      (see `inline-attachments.test.ts` for its cases). That layer
 *      rejects non-Blob hostnames, non-HTTPS, and any path whose first
 *      segment doesn't match the authenticated userId.
 *
 *   2. **Wrong-type smuggling.** `resolveBlobUrl` enforces an extension
 *      allowlist; we narrow it to `.png` only here (the screenshot capture
 *      always saves as PNG and the LLM tool result is hardcoded to
 *      `image/png`). Defence in depth on top of that: we verify the actual
 *      PNG magic bytes before returning, so a non-PNG file masquerading as
 *      `.png` still gets rejected here even if the upload route ever
 *      regressed its MIME check.
 *
 *   3. **Oversized payloads.** Capped at 24 MB — generous given the
 *      4096-px longest-edge clamp the iframe-side script applies, but
 *      tight enough that a malicious renderer can't OOM the model layer.
 *
 *   4. **Non-string / undefined URLs.** Defensive type check before any
 *      network call. `resolveBlobUrl` itself defends against this too,
 *      but failing fast avoids unnecessary I/O.
 */
export async function readScreenshotUploadAsBase64(
  url: unknown,
  userId: string,
): Promise<string | null> {
  if (typeof url !== "string") return null;

  const validatedUrl = resolveBlobUrl(url, userId);
  if (!validatedUrl) return null;

  // Screenshots are always saved as PNG; restricting to .png here means
  // we can hardcode the model-side mediaType to image/png and skip a
  // runtime mime-detect step that could otherwise be tricked.
  const lastDot = new URL(validatedUrl).pathname.lastIndexOf(".");
  const ext =
    lastDot !== -1
      ? new URL(validatedUrl).pathname.slice(lastDot).toLowerCase()
      : "";
  if (ext !== ".png") return null;

  try {
    const response = await fetch(validatedUrl);
    if (!response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    if (!hasPngMagicBytes(buf)) return null;
    if (buf.length > MAX_SCREENSHOT_BYTES) return null;
    return buf.toString("base64");
  } catch (err) {
    console.error("[screenshot-upload] failed to read", err);
    return null;
  }
}

/**
 * The first 8 bytes of every PNG file. Reference:
 * https://www.w3.org/TR/png/#5PNG-file-signature
 */
const PNG_MAGIC = Object.freeze<readonly number[]>([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const MAX_SCREENSHOT_BYTES = 24 * 1024 * 1024;

export function hasPngMagicBytes(
  buf: Uint8Array | Buffer | ArrayLike<number>,
): boolean {
  if (!buf || (buf as { length?: number }).length === undefined) return false;
  const bytes = buf as ArrayLike<number>;
  if (bytes.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Validate that a string is a `data:image/png;base64,...` URL with a
 * well-formed body and a sane size. Used in two places: the iframe-screenshot
 * helper rejects iframe replies that don't match (so we never upload a
 * non-PNG), and the orchestrator double-checks before posting to the upload
 * endpoint. Pure / no IO so it's safe to import on the client.
 */
export function isValidPngDataUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const PREFIX = "data:image/png;base64,";
  if (!s.startsWith(PREFIX)) return false;
  if (s.length > MAX_DATA_URL_LENGTH) return false;
  const body = s.slice(PREFIX.length);
  if (body.length === 0) return false;
  // Strict base64 alphabet — rejects whitespace, urls, html escapes,
  // anything that isn't standard base64.
  return /^[A-Za-z0-9+/]+={0,2}$/.test(body);
}

// Allow a generous upper bound — at pixel-ratio 2 with the 4096 longest-edge
// cap the captured PNG is at most a few MB raw. Base64 is ~33% larger, plus
// the prefix, so 32 MB of dataUrl text covers any realistic capture without
// permitting a runaway tab to fill the upload endpoint.
const MAX_DATA_URL_LENGTH = 32 * 1024 * 1024;
