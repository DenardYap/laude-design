import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";

/**
 * Replace anything that wouldn't survive on a real filesystem (Windows,
 * macOS, Linux). We're aiming for "looks the same as the user wrote it"
 * while still being safe to extract anywhere.
 */
function sanitizeSegment(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/^\.+$/g, "-")
    .trim();
  return cleaned || fallback;
}

/**
 * Strip leading slashes from a design file path so it joins cleanly under a
 * design folder inside the zip.
 */
function normalizeFilePath(path: string): string {
  return path.replace(/^\/+/, "");
}

/**
 * Build the absolute folder path inside the zip for a design — walks the
 * `parentId` chain so nested folders are preserved exactly as the user
 * arranged them.
 */
function pathForDesign(
  design: DesignDTO,
  foldersById: Map<string, FolderDTO>,
): string[] {
  const segments: string[] = [];
  let cursor = design.folderId ? foldersById.get(design.folderId) : undefined;
  // Guard against accidental cycles in the folder graph — pathological but
  // possible if a future migration breaks invariants.
  let depth = 0;
  while (cursor && depth < 32) {
    segments.unshift(sanitizeSegment(cursor.name, "folder"));
    cursor = cursor.parentId ? foldersById.get(cursor.parentId) : undefined;
    depth += 1;
  }
  segments.push(sanitizeSegment(design.name, "design"));
  return segments;
}

interface BuildProjectZipOptions {
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
}

/**
 * Produces a zip Blob mirroring the project's exact folder + file layout.
 * jszip is dynamically imported so it never lands in the main bundle —
 * users only pay for it when they actually click "Download project .zip".
 */
export async function buildProjectZip({
  projectName,
  folders,
  designs,
}: BuildProjectZipOptions): Promise<Blob> {
  const { default: JSZip } = await import("jszip");

  const foldersById = new Map<string, FolderDTO>();
  for (const f of folders) foldersById.set(f.id, f);

  const root = new JSZip();

  // De-dupe identical destination paths (e.g. two designs with the same
  // name in the same folder) by suffixing `-2`, `-3`, …
  const usedPaths = new Set<string>();
  function uniquePath(segments: string[]): string[] {
    let candidate = segments.join("/");
    let n = 2;
    while (usedPaths.has(candidate)) {
      const suffixed = [...segments];
      suffixed[suffixed.length - 1] = `${segments[segments.length - 1]}-${n}`;
      candidate = suffixed.join("/");
      n += 1;
    }
    usedPaths.add(candidate);
    return candidate.split("/");
  }

  for (const design of designs) {
    const designPath = uniquePath(pathForDesign(design, foldersById));
    if (design.files.length === 0) {
      // jszip creates parent dirs implicitly when a file is added, so an
      // empty design wouldn't appear at all. Drop a placeholder so users
      // can see every design in the export.
      root.file(
        [...designPath, ".empty"].join("/"),
        "This design is empty. Open it in Laude Design to add files.\n",
      );
      continue;
    }
    for (const file of design.files) {
      const filePath = [...designPath, normalizeFilePath(file.path)].join("/");
      root.file(filePath, file.content);
    }
  }

  root.file(
    "README.md",
    [
      `# ${projectName}`,
      "",
      "Exported from Laude Design. Each design lives in its own folder, with",
      "the original file paths preserved exactly as they appear in the",
      "workspace. Drop this directory into your editor or hand the whole zip",
      "to a coding agent.",
      "",
      `- Designs: ${designs.length}`,
      `- Folders: ${folders.length}`,
      "",
    ].join("\n"),
  );

  return root.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function suggestedZipName(projectName: string): string {
  return `${sanitizeSegment(projectName, "project")}.zip`;
}
