"use client";

import { useMemo } from "react";
import type { RefObject } from "react";
import { match } from "ts-pattern";

import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { EmptyCanvas } from "@/components/workspace/canvas/empty-canvas";
import { FilesTree } from "@/components/workspace/canvas/files-tree";
import { DesignRenderer } from "@/components/workspace/canvas/design-renderer";
import type { CanvasPaneProps } from "@/components/workspace/canvas/types/canvas-pane";

export { CanvasHeader } from "@/components/workspace/canvas/canvas-header";

export function CanvasPane({
  projectId,
  projectName,
  folders,
  designs,
  captureRef,
  viewportRef,
}: CanvasPaneProps) {
  const activeTab = useWorkspaceStore(
    (s) => s.activeTabByProject[projectId] ?? "files",
  );
  const hasHydrated = useWorkspaceStore((s) => s._hasHydrated);

  const designById = useMemo(() => {
    const map = new Map<string, DesignDTO>();
    for (const d of designs) map.set(d.id, d);
    return map;
  }, [designs]);

  // Stamp the currently-rendered design id on the canvas root so the agent's
  // self-critique screenshot helper can verify that the iframe it's about to
  // capture matches the design it was asked to capture. Without this, a fast
  // tab switch between request and capture could result in screenshotting the
  // wrong design (or worse — the user's currently-focused work).
  const activeDesignId = activeTab.startsWith("design:")
    ? activeTab.slice("design:".length)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div
        data-canvas-root
        data-design-id={activeDesignId ?? undefined}
        className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-canvas"
      >
        {/* Hold a neutral canvas-textured placeholder until Zustand's persist
            middleware has finished reading localStorage. This prevents a flash
            of the Files tree when the user's last tab was a design. */}
        {!hasHydrated ? (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(hsl(var(--canvas-grid)) 0.6px, transparent 0.6px)",
              backgroundSize: "5px 5px",
            }}
          />
        ) : match(activeTab)
            .with("files", () => (
              <FilesTree
                projectId={projectId}
                projectName={projectName}
                folders={folders}
                designs={designs}
              />
            ))
            .otherwise((tab) => {
              const designId = tab.replace(/^design:/, "");
              const design = designById.get(designId);
              if (!design) return <EmptyCanvas />;
              return (
                <DesignRenderer
                  projectId={projectId}
                  design={design}
                  captureRef={captureRef}
                  viewportRef={viewportRef}
                />
              );
            })}
      </div>
    </div>
  );
}
