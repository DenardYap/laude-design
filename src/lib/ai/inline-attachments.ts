import { readFile } from "fs/promises";
import path from "path";

import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";

/**
 * Anthropic (and most providers) reject relative file URLs because the AI
 * SDK has no host to resolve them against — the fetch fails server-side and
 * the bytes that reach the model are either empty or stray HTML, which then
 * surfaces as `image.source.base64: Invalid base64 data` from Anthropic.
 *
 * We persist messages to the database with their compact `/uploads/...`
 * URLs (so the chat history doesn't bloat with embedded base64), but rewrite
 * those URLs to inline `data:` URLs immediately before handing off to the
 * model. Files live under `public/uploads/...` on disk so we can read them
 * directly without a network round-trip.
 */

const UPLOADS_PREFIX = "/uploads/";

export async function inlineAttachmentDataUrls(
  messages: UIMessage[],
): Promise<UIMessage[]> {
  return Promise.all(messages.map(inlineMessage));
}

async function inlineMessage(message: UIMessage): Promise<UIMessage> {
  const parts = await Promise.all(message.parts.map(inlinePart));
  return { ...message, parts };
}

async function inlinePart(
  part: UIMessagePart<UIDataTypes, UITools>,
): Promise<UIMessagePart<UIDataTypes, UITools>> {
  if (part.type !== "file") return part;
  const url = part.url;
  if (typeof url !== "string" || !url.startsWith(UPLOADS_PREFIX)) return part;

  try {
    // Strip any query string before resolving on disk.
    const clean = url.split("?")[0]!.split("#")[0]!;
    const filePath = path.join(process.cwd(), "public", clean);
    const buf = await readFile(filePath);
    const mediaType = part.mediaType || guessMimeType(clean);
    return {
      ...part,
      url: `data:${mediaType};base64,${buf.toString("base64")}`,
    };
  } catch (err) {
    // Don't fail the entire turn over a missing file. Log and pass through —
    // the SDK will then complain (or skip) that single part rather than
    // dropping the whole message.
    console.error("[inline-attachments] failed to inline", url, err);
    return part;
  }
}

// Minimal media-type inference for the file extensions our uploader accepts.
// Mirrors the `ALLOWED` regex in `src/app/api/projects/[id]/upload/route.ts`.
function guessMimeType(url: string): string {
  const ext = path.extname(url).toLowerCase();
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
    default:
      return "application/octet-stream";
  }
}
