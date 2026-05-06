import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM with a 96-bit IV per NIST SP 800-38D recommendation. The
// auth tag is stored alongside the ciphertext so decryption can verify
// integrity before returning the plaintext.
const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;

// Validated once at module load so a missing/wrong key fails immediately on
// startup rather than only when the first chat request hits the crypto path.
function loadKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be 32 bytes (base64-encoded). Generate with: openssl rand -base64 32",
    );
  }
  return buf;
}

const ENCRYPTION_KEY = loadKey();

/**
 * Encrypt a UTF-8 string with AES-256-GCM. Output format is
 * `<iv>:<authTag>:<ciphertext>` with each segment base64-encoded so the
 * whole payload is safe to round-trip through Postgres TEXT columns.
 */
export function encryptSecret(plaintext: string): string {
  const key = ENCRYPTION_KEY;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

/**
 * Decrypt a payload produced by `encryptSecret`. Throws if the auth tag
 * doesn't match — never returns partially-decrypted data.
 */
export function decryptSecret(payload: string): string {
  const key = ENCRYPTION_KEY;
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext payload");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}
