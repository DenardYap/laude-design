"use client";

import { useEffect, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";

import type { DesignFileDTO } from "@/lib/workspace/types";
import { SANDPACK_RUNTIME_PATHS } from "@/components/workspace/canvas/utils/sandpack-files";

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
  }, [designFiles]);

  return null;
}
