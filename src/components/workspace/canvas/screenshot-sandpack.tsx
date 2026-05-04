"use client";

import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";

import type { DesignDTO, DesignFileDTO } from "@/lib/workspace/types";
import {
  buildSandpackFiles,
  SANDPACK_RUNTIME_PATHS,
} from "@/components/workspace/canvas/sandpack-files";

/**
 * The CSS pixel size of the hidden screenshot iframe. Picked to match a
 * mainstream "small laptop" viewport so designs that respond to standard
 * `md:` / `lg:` Tailwind breakpoints lay out correctly. The actual capture
 * is `fullPage: true` so the iframe height is irrelevant for the captured
 * image height — the in-iframe screenshot script measures `scrollHeight`
 * and renders the entire scroll extent regardless of the wrapper's height.
 *
 * 1280 × 800 is also wide enough that desktop-first designs render at their
 * intended layout; narrower widths trigger collapsed mobile layouts that
 * would force the agent to critique the wrong layout shape.
 */
export const SCREENSHOT_FRAME_WIDTH = 1280;
export const SCREENSHOT_FRAME_HEIGHT = 800;

/**
 * Stable references — same trick as `DesignRenderer`. Without these, every
 * parent re-render shifts the `customSetup` / `options` identity and
 * Sandpack tears down + remounts the iframe, defeating the warm-mount
 * caching this whole component exists to enable.
 */
const SANDPACK_CUSTOM_SETUP = { entry: "/index.tsx" } as const;
const SANDPACK_OPTIONS = {
  classes: { "sp-preview-iframe": "sp-preview-iframe" },
  recompileMode: "delayed" as const,
  recompileDelay: 250,
  externalResources: ["https://cdn.tailwindcss.com"],
};

interface ScreenshotSandpackProps {
  /**
   * The design to render. Changing the design's `id` triggers a remount
   * via `key={design.id}` in the parent host so the bundler starts fresh
   * with the new file set; same-id updates flow through `updateFile` in
   * the `<FileMirror/>` child without restarting Sandpack.
   */
  design: DesignDTO;
  /**
   * Forwarded ref so the host can DOM-query the live iframe element. We
   * stamp `data-screenshot-host` on the wrapper so the parent can scope
   * its iframe lookup to *this* Sandpack and never accidentally pick up
   * the visible canvas's iframe.
   */
  hostRef: RefObject<HTMLDivElement | null>;
}

/**
 * Off-screen, minimal Sandpack mount the agent uses to take screenshots
 * without disrupting the user's canvas view.
 *
 * Differences from `<DesignRenderer/>`:
 *   - No zoom (no transform / scaled wrapper).
 *   - No drawing / tagger overlays.
 *   - No `CanvasLoadingOverlay` (the host doesn't need to show one — it
 *     just waits for the iframe to be hot before requesting a capture).
 *   - Fixed pixel size set by `SCREENSHOT_FRAME_*` so designs render at a
 *     deterministic viewport (the agent needs the same layout shape every
 *     time, so a tiny pane doesn't trick it into critiquing collapsed
 *     mobile breakpoints).
 *   - Mounted off-screen via inline styles in the parent host — see
 *     `screenshot-host.tsx` for the visibility argument.
 */
export function ScreenshotSandpack({ design, hostRef }: ScreenshotSandpackProps) {
  // Memoize against design.id so file-content edits flow through the file
  // mirror effect rather than remounting Sandpack. Same rule as the visible
  // renderer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialFiles = useMemo(
    () => buildSandpackFiles(design.files),
    [design.id],
  );

  return (
    <div
      ref={hostRef}
      data-screenshot-host
      data-design-id={design.id}
      style={{
        width: `${SCREENSHOT_FRAME_WIDTH}px`,
        height: `${SCREENSHOT_FRAME_HEIGHT}px`,
        display: "flex",
      }}
    >
      <SandpackProvider
        key={design.id}
        template="react-ts"
        files={initialFiles}
        options={SANDPACK_OPTIONS}
        customSetup={SANDPACK_CUSTOM_SETUP}
        theme="light"
        style={{ height: "100%", width: "100%", display: "flex" }}
      >
        <SandpackLayout
          className="!h-full !w-full !rounded-none !border-0 !bg-transparent"
          style={{ height: "100%", width: "100%", flex: 1 }}
        >
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            showRestartButton={false}
            showNavigator={false}
            showSandpackErrorOverlay={false}
            style={{ height: "100%", width: "100%", border: 0, flex: 1 }}
          />
        </SandpackLayout>
        <FileMirror designFiles={design.files} />
      </SandpackProvider>
    </div>
  );
}

/**
 * Push file edits from updated `designFiles` props into the live bundler
 * without remounting. Mirrors the same behavior as
 * `DesignerInternals` in the visible renderer — including the deletion
 * cleanup that respects `SANDPACK_RUNTIME_PATHS` so we don't accidentally
 * rip out `/package.json` and break the bundle.
 */
function FileMirror({ designFiles }: { designFiles: DesignFileDTO[] }) {
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
