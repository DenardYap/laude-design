"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";

import type { DesignDTO } from "@/lib/workspace/types";
import { buildSandpackFiles } from "@/components/workspace/canvas/utils/sandpack-files";
import { FileMirror } from "@/components/workspace/canvas/file-mirror";
import type { ScreenshotSandpackProps } from "@/components/workspace/canvas/types/screenshot";

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
export function ScreenshotSandpack({ design, hostRef, onReady }: ScreenshotSandpackProps) {
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
        <ReadinessMonitor onReady={onReady} />
      </SandpackProvider>
    </div>
  );
}

/**
 * Lives inside `SandpackProvider` so it can call `listen`. Fires `onReady`
 * when Sandpack's bundler emits `"done"` — the same signal `DesignerInternals`
 * uses to hide the loading overlay. At this point the compiled bundle is live
 * in the preview iframe and the screenshot script has installed, so the host
 * can attempt `requestIframeScreenshot` without relying on a blind timeout.
 */
function ReadinessMonitor({ onReady }: { onReady?: () => void }) {
  const { listen } = useSandpack();

  const onReadyRef = useRef(onReady);
  useLayoutEffect(() => {
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    return listen((message) => {
      if (message.type === "done") {
        onReadyRef.current?.();
      }
    });
    // `listen` is stable inside the Sandpack context; omitted intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

