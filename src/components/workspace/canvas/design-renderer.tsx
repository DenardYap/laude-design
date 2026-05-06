"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { buildSandpackFiles } from "@/components/workspace/canvas/utils/sandpack-files";
import { CanvasLoadingOverlay } from "@/components/workspace/canvas/canvas-loading-overlay";
import { DrawingOverlay } from "@/components/workspace/canvas/drawing/drawing-overlay";
import { EmptyCanvas } from "@/components/workspace/canvas/empty-canvas";
import { useCanvasWheelZoom } from "@/components/workspace/canvas/hooks/use-canvas-wheel-zoom";
import { DesignerInternals } from "@/components/workspace/canvas/designer-internals";
import type { DesignRendererProps } from "@/components/workspace/canvas/types/design-renderer";
import {
  SANDPACK_CUSTOM_SETUP,
  SANDPACK_OPTIONS,
} from "@/components/workspace/canvas/utils/sandpack-options";

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialFiles = useMemo(
    () => buildSandpackFiles(design.files),
    [design.id],
  );

  if (isEmpty) {
    return <EmptyCanvas />;
  }

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
            // Remount only when switching between designs. 
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
      <CanvasLoadingOverlay
        key={`${design.id}-${loadGen}`}
        ready={sandpackReady}
      />
    </div>
  );
}

