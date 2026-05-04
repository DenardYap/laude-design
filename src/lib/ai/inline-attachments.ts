import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";

/**
 * Anthropic (and most providers) reject relative or external file URLs
 * because the AI SDK has no host to resolve them against — the fetch fails
 * server-side and the bytes that reach the model are either empty or stray
 * HTML, which then surfaces as `image.source.base64: Invalid base64 data`.
 *
 * We persist messages to the database with their compact Vercel Blob URLs
 * (so the chat history doesn't bloat with embedded base64), but rewrite
 * those URLs to inline `data:` URLs immediately before handing off to the
 * model.
 *
 * SECURITY — the `url` here comes from a request body that any authenticated
 * user can craft. Three layers of defence keep that input from turning into
 * an arbitrary remote-file read:
 *
 *   1. Only `https://` URLs on the Vercel Blob CDN hostname suffix are
 *      accepted — anything else (relative paths, other hosts) is skipped.
 *   2. The URL path must start with `/<userId>/` (the prefix the upload
 *      route writes), so a user cannot inline another user's file.
 *   3. The final path segment's extension must be in the allowlist (images,
 *      PDF, plain text). Even if the above checks ever regressed, an
 *      attacker still couldn't exfiltrate arbitrary data through the model.
 */

const BLOB_HOSTNAME_SUFFIX = ".public.blob.vercel-storage.com";

// Mirrors the MIME → extension allowlist in the upload route.
const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
]);

// Defence-in-depth: even though `userId` always originates from the
// authenticated session in production callers, validating its shape here
// means a future caller bug (e.g. passing an unsanitised path segment)
// can't turn into a cross-tenant read primitive.
const SAFE_USER_ID = /^[A-Za-z0-9_-]+$/;

export async function inlineAttachmentDataUrls(
  messages: UIMessage[],
  userId: string,
): Promise<UIMessage[]> {
  return Promise.all(messages.map((m) => inlineMessage(m, userId)));
}

async function inlineMessage(
  message: UIMessage,
  userId: string,
): Promise<UIMessage> {
  const parts = await Promise.all(
    message.parts.map((p) => inlinePart(p, userId)),
  );
  return { ...message, parts };
}

async function inlinePart(
  part: UIMessagePart<UIDataTypes, UITools>,
  userId: string,
): Promise<UIMessagePart<UIDataTypes, UITools>> {
  if (part.type !== "file") return part;
  const url = part.url;
  if (typeof url !== "string") return part;

  const validatedUrl = resolveBlobUrl(url, userId);
  if (!validatedUrl) return part;

  try {
    const response = await fetch(validatedUrl);
    if (!response.ok) return part;
    const buf = Buffer.from(await response.arrayBuffer());
    const mediaType = part.mediaType || guessMimeType(validatedUrl);
    return {
      ...part,
      url: `data:${mediaType};base64,${buf.toString("base64")}`,
    };
  } catch (err) {
    console.error("[inline-attachments] failed to inline", url, err);
    return part;
  }
}

/**
 * Validate a Vercel Blob URL and confirm it belongs to the given user.
 * Returns the URL unchanged when valid, or `null` when the URL is
 * malformed, points to another user's file, or has a disallowed extension.
 * Callers treat `null` as "skip this part".
 *
 * Exported for unit testing — the security guarantees of the whole
 * inlining flow live inside this function, so it has its own test suite.
 */
export function resolveBlobUrl(url: string, userId: string): string | null {
  if (!SAFE_USER_ID.test(userId)) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (!parsed.hostname.endsWith(BLOB_HOSTNAME_SUFFIX)) return null;

  // The upload route stores files at `/<userId>/<uuid>.<ext>`.
  // Verify ownership by confirming the path starts with the user's prefix.
  const expectedPrefix = `/${userId}/`;
  if (!parsed.pathname.startsWith(expectedPrefix)) return null;

  const rest = parsed.pathname.slice(expectedPrefix.length);
  if (!rest) return null;

  const lastDot = rest.lastIndexOf(".");
  if (lastDot === -1) return null;
  const ext = rest.slice(lastDot).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;

  return url;
}

// Minimal media-type inference from the URL pathname extension.
// Mirrors the `MIME_TO_EXT` map in the upload route.
function guessMimeType(url: string): string {
  const pathname = new URL(url).pathname;
  const lastDot = pathname.lastIndexOf(".");
  const ext = lastDot !== -1 ? pathname.slice(lastDot).toLowerCase() : "";
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}
