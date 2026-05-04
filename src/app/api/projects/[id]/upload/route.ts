import { randomUUID } from "crypto";

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Strict MIME → storage extension allowlist.
 *
 * Two threats this map defends against:
 *
 *   1. **Stored XSS.** Files are served by Vercel Blob's CDN on a separate
 *      domain, so cross-origin injection is already isolated. We still
 *      restrict extensions to prevent MIME spoofing and to bound what the
 *      AI model can ever receive.
 *
 *   2. **MIME spoofing.** The stored pathname is server-controlled: a UUID
 *      + the canonical extension from this map, derived from the *claimed*
 *      MIME (which we then verify against magic bytes). The browser's
 *      original filename is never used for the storage path.
 */
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
};

/**
 * Magic-byte signatures for the binary types. If a sniffer matches we
 * insist the claimed MIME matches the sniffed MIME — that catches an
 * attacker uploading an HTML file with `Content-Type: image/png` to smuggle
 * script content past the MIME allowlist. Plain-text types intentionally
 * skip this check (they have no reliable magic bytes).
 */
const MAGIC_SNIFFERS: Array<{ mime: string; check: (b: Buffer) => boolean }> = [
  {
    mime: "image/png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47,
  },
  {
    mime: "image/jpeg",
    check: (b) =>
      b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/gif",
    check: (b) => {
      if (b.length < 6) return false;
      const head = b.subarray(0, 6).toString("ascii");
      return head === "GIF87a" || head === "GIF89a";
    },
  },
  {
    mime: "image/webp",
    check: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    mime: "application/pdf",
    check: (b) => b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-",
  },
];

function sniffMime(buf: Buffer): string | null {
  for (const s of MAGIC_SNIFFERS) {
    if (s.check(buf)) return s.mime;
  }
  return null;
}

// Cuid (Prisma default) is alphanumeric. Anything else means our session
// cookie was tampered with — bail before we use the value as a path segment.
const SAFE_USER_ID = /^[A-Za-z0-9_-]+$/;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  if (!SAFE_USER_ID.test(userId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 413 },
    );
  }

  const claimedMime = (file.type || "").toLowerCase();
  const ext = MIME_TO_EXT[claimedMime];
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  const sniffed = sniffMime(buf);
  if (sniffed !== null && sniffed !== claimedMime) {
    return NextResponse.json(
      {
        error: `File contents don't match the declared type (${claimedMime}).`,
      },
      { status: 415 },
    );
  }

  // Server-controlled pathname: <userId>/<uuid><ext>. The userId prefix
  // lets `resolveBlobUrl` enforce per-user ownership when the server later
  // fetches the file to inline it for the model.
  const filename = `${randomUUID()}${ext}`;
  const pathname = `${userId}/${filename}`;

  const blob = await put(pathname, buf, {
    access: "public",
    contentType: claimedMime,
  });

  // Sanitised display name for the chat UI. Strip control characters and
  // anything that looks like a path separator.
  const safeName = (file.name || filename)
    .replace(/[\u0000-\u001f/\\]/g, "_")
    .slice(0, 200);

  return NextResponse.json({
    url: blob.url,
    name: safeName,
    mimeType: claimedMime,
    size: file.size,
  });
}
