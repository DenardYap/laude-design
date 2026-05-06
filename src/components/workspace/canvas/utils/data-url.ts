/**
 * Convert a data URL to a `File` object.
 *
 * fetch(dataUrl) is blocked by CSP (connect-src doesn't cover data: URIs),
 * so we decode the base64 payload directly instead.
 */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], name, { type: mime });
}
