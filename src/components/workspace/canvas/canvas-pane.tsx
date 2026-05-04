"use client";

import { useMemo } from 'react';
import type { RefObject } from 'react';

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FolderPlus, Plus } from "lucide-react";
import { match } from "ts-pattern";
import { toast } from "sonner";

import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  nextPendingDesignId,
  nextPendingFolderId,
  useOptimisticFilesStore,
} from "@/stores/optimistic-files-store";
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

  const addPendingFolder = useOptimisticFilesStore((s) => s.addPendingFolder);
  const addPendingDesign = useOptimisticFilesStore((s) => s.addPendingDesign);
  const confirmPendingFolder = useOptimisticFilesStore(
    (s) => s.confirmPendingFolder,
  );
  const confirmPendingDesign = useOptimisticFilesStore(
    (s) => s.confirmPendingDesign,
  );
  const dropPendingFolder = useOptimisticFilesStore(
    (s) => s.dropPendingFolder,
  );
  const dropPendingDesign = useOptimisticFilesStore(
    (s) => s.dropPendingDesign,
  );

  const newFolder = useMutation({
    mutationFn: async ({ tempId }: { tempId: string }) => {
      const folder = await createFolder(projectId, "New folder", null);
      return { tempId, folder };
    },
    onMutate: ({ tempId }) => {
      addPendingFolder({ id: tempId, name: "New folder", parentId: null });
    },
    onSuccess: ({ tempId, folder }) => {
      confirmPendingFolder(tempId, folder);
      toast.success("Folder created");
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingFolder(tempId);
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });
  const newDesign = useMutation({
    mutationFn: async ({ tempId }: { tempId: string }) => {
      const design = await createDesign(projectId, {
        name: "Untitled design",
        folderId: null,
      });
      return { tempId, design };
    },
    onMutate: ({ tempId }) => {
      addPendingDesign({
        id: tempId,
        name: "Untitled design",
        folderId: null,
        files: [],
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: ({ tempId, design }) => {
      confirmPendingDesign(tempId, design);
      openTab(projectId, design.id);
      toast.success("Design created");
      router.refresh();
    },
    onError: (e, { tempId }) => {
      dropPendingDesign(tempId);
      toast.error(e instanceof Error ? e.message : "Failed");
    },
  });

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="New folder"
            className="size-7"
            icon={<FolderPlus className="size-3.5" />}
            onClick={() =>
              newFolder.mutate({ tempId: nextPendingFolderId() })
            }
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
            onClick={() =>
              newDesign.mutate({ tempId: nextPendingDesignId() })
            }
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
  const hasHydrated = useWorkspaceStore((s) => s._hasHydrated);

  const isCanvasEmpty = useMemo(() => {
    if (!activeTab.startsWith("design:")) return true;
    const designId = activeTab.slice("design:".length);
    const design = designs.find((d) => d.id === designId);
    return !design || design.files.length === 0;
  }, [activeTab, designs]);

  // Don't render the trailing toolbar until the store has hydrated from
  // localStorage — avoids a flash where FilesActions appears for a frame
  // before the persisted design tab is known.
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

interface CanvasPaneProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
  captureRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
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
