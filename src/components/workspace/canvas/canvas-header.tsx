"use client";

import { useMemo } from "react";
import { match } from "ts-pattern";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { CanvasTabStrip } from "@/components/workspace/canvas/canvas-tab-strip";
import { CanvasToolbar } from "@/components/workspace/canvas/canvas-toolbar";
import { FilesActions } from "@/components/workspace/canvas/files-actions";
import type { CanvasHeaderProps } from "@/components/workspace/canvas/types/canvas-pane";

export function CanvasHeader({
  projectId,
  designs,
  onCaptureFull,
  onStartAreaCapture,
  onRequestSwitch,
}: CanvasHeaderProps) {
  const activeTab = useWorkspaceStore(
    (s) => s.activeTabByProject[projectId] ?? "files",
  );
  const hasHydrated = useWorkspaceStore((s) => s._hasHydrated);

  const isCanvasEmpty = useMemo(() => {
    if (!activeTab.startsWith("design:")) return true;
    const designId = activeTab.slice("design:".length);
    const design = designs.find((d) => d.id === designId);
    return !design || design.files.length === 0;
  }, [activeTab, designs]);

  // Don't render the trailing toolbar until the store has hydrated from localStorage 
  const trailing = !hasHydrated ? null : match(activeTab)
    .with("files", () => <FilesActions projectId={projectId} />)
    .otherwise(() => (
      <CanvasToolbar
        onCaptureFull={onCaptureFull}
        onStartAreaCapture={onStartAreaCapture}
        onRequestSwitch={onRequestSwitch}
        isCanvasEmpty={isCanvasEmpty}
      />
    ));

  return (
    <div className="flex h-full items-center justify-between gap-2 bg-background pl-3 pr-2 py-1.5 ">
      <CanvasTabStrip projectId={projectId} designs={designs} />
      {trailing ? (
        <div className="flex h-7 items-center gap-2">
          <div className="h-5 w-px bg-border" aria-hidden="true" />
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
