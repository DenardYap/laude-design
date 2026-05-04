import { describe, expect, it } from "vitest";

import { resolveBlobUrl } from "./inline-attachments";

/**
 * Security-focused tests for `resolveBlobUrl`.
 *
 * This is the chokepoint that decides which remote URL the AI inliner
 * will fetch on behalf of a request. If it ever returns a URL for an
 * unauthenticated resource, a different user's file, or a non-Blob host,
 * the consequences range from cross-tenant data leakage to SSRF.
 * Every test here corresponds to a concrete attack the function must
 * neutralise; nothing is theoretical.
 */

const USER = "user_abc123";
const OTHER = "user_xyz789";
const STORE = "abc123def456";
const BASE = `https://${STORE}.public.blob.vercel-storage.com`;

const blobUrl = (userId: string, filename: string) =>
  `${BASE}/${userId}/${filename}`;

describe("resolveBlobUrl — allowed URLs", () => {
  it("resolves a basic per-user image upload", () => {
    expect(resolveBlobUrl(blobUrl(USER, "screenshot.png"), USER)).toBe(
      blobUrl(USER, "screenshot.png"),
    );
  });

  it("accepts every extension on the allowlist", () => {
    for (const ext of ["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "md", "csv"]) {
      expect(resolveBlobUrl(blobUrl(USER, `file.${ext}`), USER)).toBe(
        blobUrl(USER, `file.${ext}`),
      );
    }
  });

  it("treats the extension check as case-insensitive", () => {
    expect(resolveBlobUrl(blobUrl(USER, "file.PNG"), USER)).toBe(
      blobUrl(USER, "file.PNG"),
    );
    expect(resolveBlobUrl(blobUrl(USER, "file.PdF"), USER)).toBe(
      blobUrl(USER, "file.PdF"),
    );
  });

  it("ignores query strings and hashes — URL passes but still points to the right blob", () => {
    // Query params and fragments don't affect ownership or extension.
    expect(resolveBlobUrl(`${blobUrl(USER, "file.png")}?v=2`, USER)).toBe(
      `${blobUrl(USER, "file.png")}?v=2`,
    );
    expect(resolveBlobUrl(`${blobUrl(USER, "file.png")}#anchor`, USER)).toBe(
      `${blobUrl(USER, "file.png")}#anchor`,
    );
  });

  it("works with a different Vercel Blob store ID (any *.public.blob.vercel-storage.com host)", () => {
    const url = `https://other-store-999.public.blob.vercel-storage.com/${USER}/file.png`;
    expect(resolveBlobUrl(url, USER)).toBe(url);
  });
});

describe("resolveBlobUrl — cross-tenant isolation", () => {
  it("rejects another user's blob URL", () => {
    expect(resolveBlobUrl(blobUrl(OTHER, "file.png"), USER)).toBeNull();
  });

  it("rejects a sibling path whose name has the user's id as a prefix", () => {
    // Without proper prefix checking, "user_abc123_evil" might match "user_abc123".
    expect(resolveBlobUrl(blobUrl(`${USER}_evil`, "file.png"), USER)).toBeNull();
    expect(resolveBlobUrl(blobUrl(`${USER}xyz`, "file.png"), USER)).toBeNull();
  });

  it("rejects a file at the store root with no user folder", () => {
    expect(resolveBlobUrl(`${BASE}/file.png`, USER)).toBeNull();
  });

  it("rejects a URL with no filename after the userId prefix", () => {
    expect(resolveBlobUrl(`${BASE}/${USER}/`, USER)).toBeNull();
  });
});

describe("resolveBlobUrl — wrong hostname", () => {
  it("rejects http:// (non-HTTPS)", () => {
    expect(
      resolveBlobUrl(
        `http://${STORE}.public.blob.vercel-storage.com/${USER}/file.png`,
        USER,
      ),
    ).toBeNull();
  });

  it("rejects a non-Blob CDN hostname", () => {
    expect(
      resolveBlobUrl(`https://evil.example.com/${USER}/file.png`, USER),
    ).toBeNull();
  });

  it("rejects a hostname that merely contains the suffix as a substring", () => {
    // e.g. attacker.com/public.blob.vercel-storage.com — not a real Blob host.
    expect(
      resolveBlobUrl(
        `https://evil.public.blob.vercel-storage.com.attacker.com/${USER}/file.png`,
        USER,
      ),
    ).toBeNull();
  });

  it("rejects relative URLs", () => {
    expect(resolveBlobUrl(`/${USER}/file.png`, USER)).toBeNull();
    expect(resolveBlobUrl(`/uploads/${USER}/file.png`, USER)).toBeNull();
  });

  it("rejects non-URL strings", () => {
    expect(resolveBlobUrl("not a url at all", USER)).toBeNull();
    expect(resolveBlobUrl("", USER)).toBeNull();
  });
});

describe("resolveBlobUrl — extension allowlist", () => {
  it("rejects executable / config / source extensions", () => {
    for (const name of [
      "script.js",
      "page.html",
      "image.svg",
      "config.json",
      "script.sh",
      "exploit.exe",
      "styles.css",
    ]) {
      expect(resolveBlobUrl(blobUrl(USER, name), USER)).toBeNull();
    }
  });

  it("rejects files with no extension", () => {
    expect(resolveBlobUrl(blobUrl(USER, "README"), USER)).toBeNull();
  });

  it("respects only the *final* extension (defeats double-extension tricks)", () => {
    // `.png.env` should be rejected — the final extension is `.env`.
    expect(resolveBlobUrl(blobUrl(USER, "file.png.env"), USER)).toBeNull();
    // `.env.png` is `.png` and should be allowed (the upload route's
    // magic-byte check is what enforces actual content).
    expect(resolveBlobUrl(blobUrl(USER, ".env.png"), USER)).toBe(
      blobUrl(USER, ".env.png"),
    );
  });
});

describe("resolveBlobUrl — userId hygiene", () => {
  it("rejects an empty userId", () => {
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "")).toBeNull();
  });

  it("rejects a userId containing path separators", () => {
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "../etc")).toBeNull();
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "a/b")).toBeNull();
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "a\\b")).toBeNull();
  });

  it("rejects a userId containing dots, NUL, or whitespace", () => {
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "..")).toBeNull();
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "user.id")).toBeNull();
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "user\0id")).toBeNull();
    expect(resolveBlobUrl(blobUrl(USER, "file.png"), "user id")).toBeNull();
  });

  it("accepts the userId formats the app actually issues", () => {
    // cuid v1: `c` + 24 lowercase alphanumerics
    const cuid = "cl9zk3xq00000abcdefghijkl";
    expect(resolveBlobUrl(blobUrl(cuid, "file.png"), cuid)).toBe(
      blobUrl(cuid, "file.png"),
    );
    // UUID v4 with dashes
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(resolveBlobUrl(blobUrl(uuid, "file.png"), uuid)).toBe(
      blobUrl(uuid, "file.png"),
    );
    // nanoid (mixed case + dashes/underscores)
    const nano = "V1StGXR8_Z5jdHi6B-myT";
    expect(resolveBlobUrl(blobUrl(nano, "file.png"), nano)).toBe(
      blobUrl(nano, "file.png"),
    );
  });
});
