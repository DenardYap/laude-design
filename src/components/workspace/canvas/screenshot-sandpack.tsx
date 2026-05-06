"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";

import { buildSandpackFiles } from "@/components/workspace/canvas/utils/sandpack-files";
import { FileMirror } from "@/components/workspace/canvas/file-mirror";
import type { ScreenshotSandpackProps } from "@/components/workspace/canvas/types/screenshot";
import {
  SCREENSHOT_FRAME_WIDTH,
  SCREENSHOT_FRAME_HEIGHT,
  SANDPACK_CUSTOM_SETUP,
  SANDPACK_OPTIONS,
} from "@/components/workspace/canvas/utils/sandpack-options";

export { SCREENSHOT_FRAME_WIDTH, SCREENSHOT_FRAME_HEIGHT };

/**
 * Off-screen, minimal Sandpack mount the agent uses to take screenshots
 * without disrupting the user's canvas view.
 */
export function ScreenshotSandpack({ design, hostRef, onReady }: ScreenshotSandpackProps) {
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
 * uses to hide the loading overlay.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

