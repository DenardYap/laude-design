"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FolderPlus, Plus } from "lucide-react";
import { match } from "ts-pattern";
import { toast } from "sonner";

import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { createFolder } from "@/server/actions/folders";
import { createDesign } from "@/server/actions/designs";
import { CanvasTabStrip } from "@/components/workspace/canvas/canvas-tab-strip";
import { CanvasToolbar } from "@/components/workspace/canvas/canvas-toolbar";
import type { ExitDrawingControl } from "@/components/workspace/canvas/drawing/use-exit-drawing";
import { EmptyCanvas } from "@/components/workspace/canvas/empty-canvas";
import { FilesTree } from "@/components/workspace/canvas/files-tree";
import { DesignRenderer } from "@/components/workspace/canvas/design-renderer";

function FilesActions({ projectId }: { projectId: string }) {
  const router = useRouter();
  const openTab = useWorkspaceStore((s) => s.openDesignTab);

  const newFolder = useMutation({
    mutationFn: () => createFolder(projectId, "New folder", null),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const newDesign = useMutation({
    mutationFn: () =>
      createDesign(projectId, { name: "Untitled design", folderId: null }),
    onSuccess: (d) => {
      openTab(projectId, d.id);
      router.refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New folder"
            className="size-7"
            icon={<FolderPlus className="size-3.5" />}
            onClick={() => newFolder.mutate()}
            disabled={newFolder.isPending}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">New folder</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New design"
            className="size-7"
            icon={<Plus className="size-3.5" />}
            onClick={() => newDesign.mutate()}
            disabled={newDesign.isPending}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom">New design</TooltipContent>
      </Tooltip>
    </div>
  );
}

interface CanvasHeaderProps {
  projectId: string;
  designs: DesignDTO[];
  onCaptureFull: () => void;
  onStartAreaCapture: () => void;
  onRequestSwitch: ExitDrawingControl["requestSwitch"];
}

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

  const trailing = match(activeTab)
    .with("files", () => <FilesActions projectId={projectId} />)
    .otherwise(() => (
      <CanvasToolbar
        onCaptureFull={onCaptureFull}
        onStartAreaCapture={onStartAreaCapture}
        onRequestSwitch={onRequestSwitch}
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

interface CanvasPaneProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
  captureRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

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

  const designById = React.useMemo(() => {
    const map = new Map<string, DesignDTO>();
    for (const d of designs) map.set(d.id, d);
    return map;
  }, [designs]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-canvas">
        {match(activeTab)
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
