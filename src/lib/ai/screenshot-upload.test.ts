import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasPngMagicBytes,
  isValidPngDataUrl,
  readScreenshotUploadAsBase64,
} from "./screenshot-upload";

/**
 * Security + correctness tests for the screenshot upload reader. The
 * function it covers is a chokepoint: every byte the agent's
 * self-critique screenshot tool ever feeds into a multimodal model
 * passes through here. If we ever return data that *isn't* an owned
 * PNG, the consequence is anywhere from "agent sees garbage" to
 * "agent inlines arbitrary content into the prompt".
 *
 * The URL-validation layer (`resolveBlobUrl`) is already covered
 * exhaustively by `inline-attachments.test.ts` — these tests focus on
 * the *additional* guarantees this layer adds:
 *   1. PNG-only extension (tighter than the inline-attachment
 *      allowlist which also lets through .jpg, .pdf, .txt, etc).
 *   2. Magic-byte verification of file contents.
 *   3. Hard size cap.
 *   4. Defensive type checks against non-string URLs.
 *
 * Network I/O is replaced with `vi.stubGlobal('fetch', ...)` so the
 * tests are hermetic and require no Vercel Blob token or network.
 */

const USER = "user_screenshot_test";
const OTHER_USER = "user_other_screenshot_test";
const STORE = "teststore123";
const BASE = `https://${STORE}.public.blob.vercel-storage.com`;

const blobUrl = (userId: string, filename: string) =>
  `${BASE}/${userId}/${filename}`;

// Smallest valid PNG: 8-byte signature + IHDR + IDAT + IEND. Hand-rolled
// so the test suite never needs a pre-baked binary fixture and runs
// hermetically. This is a real 1×1 transparent PNG that any image
// decoder accepts.
const TINY_PNG = Buffer.from([
  // PNG signature
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  // IHDR chunk (length 13)
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
  // IDAT chunk (length 10)
  0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54,
  0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05,
  0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4,
  // IEND chunk (length 0)
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

function mockFetch(body: Buffer | null, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: async () =>
        body ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new ArrayBuffer(0),
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readScreenshotUploadAsBase64 — happy path", () => {
  it("returns base64 PNG bytes for a real PNG owned by the user", async () => {
    mockFetch(TINY_PNG);
    const result = await readScreenshotUploadAsBase64(
      blobUrl(USER, "valid.png"),
      USER,
    );
    expect(result).not.toBeNull();
    expect(result).toBe(TINY_PNG.toString("base64"));
  });

  it("preserves byte-perfect content (round-trips through base64)", async () => {
    mockFetch(TINY_PNG);
    const result = await readScreenshotUploadAsBase64(
      blobUrl(USER, "valid.png"),
      USER,
    );
    const decoded = Buffer.from(result!, "base64");
    expect(decoded.equals(TINY_PNG)).toBe(true);
  });
});

describe("readScreenshotUploadAsBase64 — wrong-type smuggling", () => {
  it("rejects a non-PNG file masquerading as .png (magic-byte check)", async () => {
    mockFetch(Buffer.from("<svg>not actually a png</svg>"));
    const result = await readScreenshotUploadAsBase64(
      blobUrl(USER, "fake.png"),
      USER,
    );
    expect(result).toBeNull();
  });

  it("rejects extensions that resolveBlobUrl would otherwise accept", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // The screenshot tool tightens the allowlist to PNG-only.
    for (const ext of ["jpg", "jpeg", "gif", "webp", "pdf", "txt", "md", "csv"]) {
      const result = await readScreenshotUploadAsBase64(
        blobUrl(USER, `file.${ext}`),
        USER,
      );
      expect(result, `extension .${ext} should be rejected`).toBeNull();
    }
    // fetch should not have been called for any of these (rejected before I/O)
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("readScreenshotUploadAsBase64 — cross-tenant access", () => {
  it("rejects another user's PNG (delegates to resolveBlobUrl)", async () => {
    const result = await readScreenshotUploadAsBase64(
      blobUrl(OTHER_USER, "private.png"),
      USER,
    );
    expect(result).toBeNull();
  });
});

describe("readScreenshotUploadAsBase64 — invalid host / non-blob URLs", () => {
  it("rejects a non-Blob CDN hostname without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await readScreenshotUploadAsBase64(
      "https://evil.example.com/valid.png",
      USER,
    );
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a relative path without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await readScreenshotUploadAsBase64(
      `/uploads/${USER}/valid.png`,
      USER,
    );
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("readScreenshotUploadAsBase64 — size cap", () => {
  it("rejects files larger than 24 MB", async () => {
    const huge = Buffer.concat([TINY_PNG, Buffer.alloc(25 * 1024 * 1024)]);
    mockFetch(huge);
    const result = await readScreenshotUploadAsBase64(
      blobUrl(USER, "huge.png"),
      USER,
    );
    expect(result).toBeNull();
  });
});

describe("readScreenshotUploadAsBase64 — HTTP errors", () => {
  it("returns null when the blob fetch returns 404", async () => {
    mockFetch(null, 404);
    const result = await readScreenshotUploadAsBase64(
      blobUrl(USER, "missing.png"),
      USER,
    );
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const result = await readScreenshotUploadAsBase64(
      blobUrl(USER, "valid.png"),
      USER,
    );
    expect(result).toBeNull();
  });
});

describe("readScreenshotUploadAsBase64 — defensive input handling", () => {
  it("returns null for non-string URL inputs without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const bad of [undefined, null, 42, {}, [], true]) {
      const result = await readScreenshotUploadAsBase64(
        bad as unknown,
        USER,
      );
      expect(result).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null for an empty userId", async () => {
    const result = await readScreenshotUploadAsBase64(
      blobUrl(USER, "valid.png"),
      "",
    );
    expect(result).toBeNull();
  });
});

describe("hasPngMagicBytes", () => {
  it("accepts the canonical 8-byte PNG signature", () => {
    expect(hasPngMagicBytes(TINY_PNG)).toBe(true);
  });

  it("rejects buffers shorter than the signature length", () => {
    expect(hasPngMagicBytes(Buffer.from([0x89, 0x50]))).toBe(false);
    expect(hasPngMagicBytes(Buffer.alloc(0))).toBe(false);
  });

  it("rejects content with the wrong first byte", () => {
    const buf = Buffer.from(TINY_PNG);
    buf[0] = 0x00;
    expect(hasPngMagicBytes(buf)).toBe(false);
  });

  it("rejects content with the wrong last signature byte", () => {
    const buf = Buffer.from(TINY_PNG);
    buf[7] = 0x00;
    expect(hasPngMagicBytes(buf)).toBe(false);
  });

  it("rejects nullish input", () => {
    expect(hasPngMagicBytes(null as unknown as Uint8Array)).toBe(false);
    expect(hasPngMagicBytes(undefined as unknown as Uint8Array)).toBe(false);
  });

  it("works on plain Uint8Array (not just Buffer)", () => {
    const u8 = new Uint8Array(TINY_PNG);
    expect(hasPngMagicBytes(u8)).toBe(true);
  });
});

describe("isValidPngDataUrl", () => {
  it("accepts a normal data URL with valid base64", () => {
    expect(
      isValidPngDataUrl(`data:image/png;base64,${TINY_PNG.toString("base64")}`),
    ).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(isValidPngDataUrl(undefined)).toBe(false);
    expect(isValidPngDataUrl(null)).toBe(false);
    expect(isValidPngDataUrl(42)).toBe(false);
    expect(isValidPngDataUrl({})).toBe(false);
  });

  it("rejects the wrong MIME type prefix", () => {
    expect(isValidPngDataUrl(`data:image/svg+xml;base64,abc`)).toBe(false);
    expect(isValidPngDataUrl(`data:image/jpeg;base64,abc`)).toBe(false);
    expect(isValidPngDataUrl(`data:text/plain;base64,abc`)).toBe(false);
  });

  it("rejects URLs that aren't base64-prefixed", () => {
    expect(isValidPngDataUrl(`data:image/png,abc`)).toBe(false);
    expect(isValidPngDataUrl(`data:image/png;charset=utf-8,abc`)).toBe(false);
  });

  it("rejects empty bodies", () => {
    expect(isValidPngDataUrl(`data:image/png;base64,`)).toBe(false);
  });

  it("rejects bodies with non-base64 characters", () => {
    expect(isValidPngDataUrl(`data:image/png;base64,  abc==`)).toBe(false);
    expect(isValidPngDataUrl(`data:image/png;base64,abc<script>`)).toBe(false);
    expect(
      isValidPngDataUrl(`data:image/png;base64,abc\nxyz==`),
    ).toBe(false);
  });

  it("rejects payloads larger than the dataUrl size cap", () => {
    const giant =
      "data:image/png;base64," + "A".repeat(32 * 1024 * 1024 + 1);
    expect(isValidPngDataUrl(giant)).toBe(false);
  });

  it("accepts standard base64 padding", () => {
    expect(isValidPngDataUrl("data:image/png;base64,abc=")).toBe(true);
    expect(isValidPngDataUrl("data:image/png;base64,ab==")).toBe(true);
    expect(isValidPngDataUrl("data:image/png;base64,abcd")).toBe(true);
  });
});
