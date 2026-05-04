"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";

import type { DesignDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { buildSandpackFiles } from "@/components/workspace/canvas/utils/sandpack-files";
import { CanvasLoadingOverlay } from "@/components/workspace/canvas/canvas-loading-overlay";
import { DrawingOverlay } from "@/components/workspace/canvas/drawing/drawing-overlay";
import { EmptyCanvas } from "@/components/workspace/canvas/empty-canvas";
import { useCanvasWheelZoom } from "@/components/workspace/canvas/hooks/use-canvas-wheel-zoom";
import { DesignerInternals } from "@/components/workspace/canvas/designer-internals";
import type { DesignRendererProps } from "@/components/workspace/canvas/types/design-renderer";

// Stable references so SandpackProvider's `useFiles`/`useClient` effects don't
// fire on every parent re-render (they diff `props.customSetup` and
// `props.options` by reference).
const SANDPACK_CUSTOM_SETUP = { entry: "/index.tsx" } as const;
const SANDPACK_OPTIONS = {
  classes: { "sp-preview-iframe": "sp-preview-iframe" },
  recompileMode: "delayed" as const,
  recompileDelay: 250,
  // Inject Tailwind via Sandpack's documented `externalResources` hook
  // instead of relying on a custom `/public/index.html`. The runtime bundler
  // doesn't always honour public/index.html overrides, which is why every
  // generated design was rendering with un-styled browser defaults.
  externalResources: ["https://cdn.tailwindcss.com"],
};

export function DesignRenderer({
  projectId,
  design,
  captureRef,
  viewportRef,
}: DesignRendererProps) {
  const zoom = useWorkspaceStore((s) => s.zoom);

  // ⌘/ctrl + wheel = zoom (browser pinch on trackpad fires the same event).
  useCanvasWheelZoom(viewportRef);

  // Overlay control: `loadGen` is bumped whenever we want the loading overlay
  // to re-appear (design switch or agent file update). `sandpackReady` flips
  // to true once Sandpack signals compilation is done, dismissing the overlay.
  const [loadGen, setLoadGen] = useState(0);
  const [sandpackReady, setSandpackReady] = useState(false);

  // Reset both flags whenever the active design switches so the overlay
  // shows fresh for the new design's compilation cycle.
  useEffect(() => {
    setLoadGen(0);
    setSandpackReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id]);

  const handleSandpackReady = useCallback(() => {
    setSandpackReady(true);
  }, []);

  const handleFilesUpdating = useCallback(() => {
    setLoadGen((g) => g + 1);
    setSandpackReady(false);
  }, []);

  const isEmpty = design.files.length === 0;
  // Memoize against design.id, NOT design.files. We want a stable initial
  // `files` prop per mounted design so Sandpack's internal `useFiles` effect
  // doesn't reset its state (and the visible/active file selection) every
  // time the server pushes new file contents. Mid-session edits are pushed
  // surgically via `sandpack.updateFile` inside <DesignerInternals/>.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialFiles = useMemo(
    () => buildSandpackFiles(design.files),
    [design.id],
  );

  if (isEmpty) {
    return <EmptyCanvas />;
  }

  // Responsive viewport simulation with scale-to-fit.
  //
  // captureRef is sized to `(1/zoom) × 100%` of the canvas pane, so the
  // Sandpack iframe's CSS viewport is `pane / zoom`. At zoom=2 (pressing +)
  // the iframe sees half the pane width → mobile/narrow breakpoints fire and
  // the content is scaled up 2× to fill the canvas (zoomed-in feel).
  // At zoom=0.5 (pressing -) the iframe sees 2× the pane width → desktop
  // breakpoints fire and the content is scaled down to fit (zoomed-out feel).
  //
  // `transform: scale(zoom)` brings the (1/zoom)-sized element back to fill
  // the canvas pane visually, so the design always fills the pane with no
  // horizontal scrollbar.
  //
  // Because the CSS transform is scale(zoom), coordinate math in the drawing
  // overlay and screenshot helpers must divide by zoom to convert from visual
  // (post-transform) coordinates back to iframe CSS pixels.
  return (
    <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-canvas">
        <div
          ref={captureRef}
          className="relative origin-top-left"
          style={{
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <SandpackProvider
            // Remount only when switching between designs. Same-id file edits
            // flow through `useFiles` and update the bundler in place — see
            // the SandpackFileSync child below.
            key={design.id}
            template="react-ts"
            files={initialFiles}
            options={SANDPACK_OPTIONS}
            customSetup={SANDPACK_CUSTOM_SETUP}
            theme="light"
            // The wrapper div needs an explicit size so the inner SandpackLayout
            // (which is a flex column) has a height to fill.
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
                showSandpackErrorOverlay
                style={{ height: "100%", width: "100%", border: 0, flex: 1 }}
              />
            </SandpackLayout>
            <DesignerInternals
              projectId={projectId}
              designFiles={design.files}
              onReady={handleSandpackReady}
              onFilesUpdating={handleFilesUpdating}
            />
          </SandpackProvider>
          <DrawingOverlay projectId={projectId} />
        </div>
      {/* Sits outside the scaled captureRef so the overlay is never distorted by the viewport simulation transform */}
      <CanvasLoadingOverlay
        key={`${design.id}-${loadGen}`}
        ready={sandpackReady}
      />
    </div>
  );
}

