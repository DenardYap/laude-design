"use client";

import { useEffect, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";

import type { DesignFileDTO } from "@/lib/workspace/types";
import { SANDPACK_RUNTIME_PATHS } from "@/components/workspace/canvas/utils/sandpack-files";

/**
 * Push file edits from updated `designFiles` props into the live bundler
 * without remounting. Mirrors the same behavior as `DesignerInternals` in
 * the visible renderer — including the deletion cleanup that respects
 * `SANDPACK_RUNTIME_PATHS` so we don't accidentally rip out `/package.json`
 * and break the bundle.
 */
export function FileMirror({ designFiles }: { designFiles: DesignFileDTO[] }) {
  const { sandpack } = useSandpack();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const designPaths = new Set(designFiles.map((f) => f.path));
    for (const f of designFiles) {
      if (SANDPACK_RUNTIME_PATHS.has(f.path)) continue;
      const current = sandpack.files[f.path]?.code;
      if (current !== f.content) {
        sandpack.updateFile(f.path, f.content);
      }
    }
    for (const path of Object.keys(sandpack.files)) {
      if (designPaths.has(path)) continue;
      if (SANDPACK_RUNTIME_PATHS.has(path)) continue;
      if (sandpack.files[path]?.hidden) continue;
      sandpack.deleteFile(path);
    }
    // Same rationale as `DesignerInternals`: read sandpack from closure on
    // every effect run so we always diff against the latest bundler state
    // rather than the snapshot at last-render-of-this-effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designFiles]);

  return null;
}
