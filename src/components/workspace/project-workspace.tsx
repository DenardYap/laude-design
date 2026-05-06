"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { useRecentsStore } from "@/stores/recents-store";
import {
  applyOptimisticOverlays,
  useOptimisticFilesStore,
} from "@/stores/optimistic-files-store";
import { ChatPane } from "@/components/workspace/chat/chat-pane";
import { CanvasPane } from "@/components/workspace/canvas/canvas-pane";
import { CanvasHeader } from "@/components/workspace/canvas/canvas-header";
import { SessionTabs } from "@/components/workspace/chat/session-tabs";
import { useCanvasScreenshot } from "@/components/workspace/canvas/hooks/use-screenshot";
import { ScreenshotAreaOverlay } from "@/components/workspace/canvas/screenshot-area-overlay";
import { ScreenshotHost } from "@/components/workspace/canvas/screenshot-host";
import { DrawingShapeBar } from "@/components/workspace/canvas/drawing/drawing-shape-bar";
import { useDrawingSend } from "@/components/workspace/canvas/drawing/hooks/use-drawing-send";
import { useExitDrawing } from "@/components/workspace/canvas/drawing/hooks/use-exit-drawing";
import { ConfirmDialog } from "@/components/ui";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { CommandPalette } from "@/components/workspace/command-palette/command-palette";
import { ExportToAgentDialog } from "@/components/workspace/export/export-to-agent-dialog";
import { useCmdKShortcut } from "@/components/workspace/command-palette/hooks/use-cmd-k-shortcut";
import { DesktopLayout } from "@/components/workspace/desktop-layout";
import { MobileLayout } from "@/components/workspace/mobile-layout";
import { useIsDesktop } from "@/lib/use-media-query";
import type { ProjectWorkspaceProps, MobileView } from "@/components/workspace/types/workspace";

export function ProjectWorkspace({
  project,
  sessions,
  folders: serverFolders,
  designs: serverDesigns,
  user,
  allProjects,
  ssrIsDesktop,
}: ProjectWorkspaceProps) {
  const hydrateSessionUsage = useWorkspaceStore((s) => s.hydrateSessionUsage);
  const addRecent = useRecentsStore((s) => s.addRecent);
  const pendingFolders = useOptimisticFilesStore((s) => s.pendingFolders);
  const pendingDesigns = useOptimisticFilesStore((s) => s.pendingDesigns);
  const deletedFolderIds = useOptimisticFilesStore((s) => s.deletedFolderIds);
  const deletedDesignIds = useOptimisticFilesStore((s) => s.deletedDesignIds);
  const folderRenameOverrides = useOptimisticFilesStore(
    (s) => s.folderRenameOverrides,
  );
  const designRenameOverrides = useOptimisticFilesStore(
    (s) => s.designRenameOverrides,
  );
  const folderParentOverrides = useOptimisticFilesStore(
    (s) => s.folderParentOverrides,
  );
  const designFolderOverrides = useOptimisticFilesStore(
    (s) => s.designFolderOverrides,
  );
  const reconcileOptimisticFiles = useOptimisticFilesStore((s) => s.reconcile);

  const { folders, designs } = useMemo(
    () =>
      applyOptimisticOverlays(serverFolders, serverDesigns, {
        pendingFolders,
        pendingDesigns,
        deletedFolderIds,
        deletedDesignIds,
        folderRenameOverrides,
        designRenameOverrides,
        folderParentOverrides,
        designFolderOverrides,
      }),
    [
      serverFolders,
      serverDesigns,
      pendingFolders,
      pendingDesigns,
      deletedFolderIds,
      deletedDesignIds,
      folderRenameOverrides,
      designRenameOverrides,
      folderParentOverrides,
      designFolderOverrides,
    ],
  );

  useEffect(() => {
    reconcileOptimisticFiles({ serverFolders, serverDesigns });
  }, [serverFolders, serverDesigns, reconcileOptimisticFiles]);

  // Server is authoritative on usage stats. 
  useEffect(() => {
    hydrateSessionUsage(sessions);
  }, [sessions, hydrateSessionUsage]);

  // Record this project visit so it surfaces in the global ⌘K palette's
  // "Recently used" group.
  useEffect(() => {
    addRecent({ kind: "project", id: project.id, name: project.name });
  }, [project.id, project.name, addRecent]);
  useCmdKShortcut();

  // Hoist captureRef/viewportRef and screenshot callbacks to the workspace level so the canvas
  // body, header, and drag-to-select overlay can all share them.
  const preWarmDesignId = useWorkspaceStore((s) => {
    const sessionId = s.activeSessionByProject[project.id];
    if (!sessionId || !(s.selfCritiqueBySession[sessionId] ?? false)) return null;
    const tab = s.activeTabByProject[project.id];
    if (!tab?.startsWith("design:")) return null;
    return tab.slice("design:".length);
  });

  const captureRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const screenshot = useCanvasScreenshot(project.id, captureRef);
  const drawingSend = useDrawingSend(project.id, viewportRef, captureRef);
  const exitDrawing = useExitDrawing(project.id);

  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const isDesktop = useIsDesktop(ssrIsDesktop);

  // Build the pane content once so we can place the same instances inside either layout.
  const chatPane = (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="h-10 shrink-0">
        <SessionTabs
          projectId={project.id}
          sessions={sessions}
        />
      </div>
      <div className="min-h-0 flex-1">
        <ChatPane projectId={project.id} hasSessions={sessions.length > 0} />
      </div>
    </div>
  );

  const canvasPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-10 shrink-0">
        <CanvasHeader
          projectId={project.id}
          designs={designs}
          onCaptureFull={screenshot.captureFull}
          onStartAreaCapture={screenshot.startAreaCapture}
          onRequestSwitch={exitDrawing.requestSwitch}
        />
      </div>
      <div className="min-h-0 flex-1">
        <CanvasPane
          projectId={project.id}
          projectName={project.name}
          folders={folders}
          designs={designs}
          captureRef={captureRef}
          viewportRef={viewportRef}
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-screen flex-col bg-background">
      <WorkspaceHeader
        projectId={project.id}
        projectName={project.name}
        user={user}
      />

      {isDesktop ? (
        <DesktopLayout
          projectId={project.id}
          sessionsPane={
            <div className="min-w-0 bg-surface">
              <SessionTabs
                projectId={project.id}
                sessions={sessions}
              />
            </div>
          }
          canvasHeader={
            <div className="min-w-0">
              <CanvasHeader
                projectId={project.id}
                designs={designs}
                onCaptureFull={screenshot.captureFull}
                onStartAreaCapture={screenshot.startAreaCapture}
                onRequestSwitch={exitDrawing.requestSwitch}
              />
            </div>
          }
          chatBody={<ChatPane projectId={project.id} hasSessions={sessions.length > 0} />}
          canvasBody={
            <CanvasPane
              projectId={project.id}
              projectName={project.name}
              folders={folders}
              designs={designs}
              captureRef={captureRef}
              viewportRef={viewportRef}
            />
          }
        />
      ) : (
        <MobileLayout
          mobileView={mobileView}
          onChangeView={setMobileView}
          chatPane={chatPane}
          canvasPane={canvasPane}
        />
      )}

      <CommandPalette
        currentProjectId={project.id}
        projects={allProjects}
        designs={designs}
      />
      <ExportToAgentDialog
        projectId={project.id}
        projectName={project.name}
        folders={folders}
        designs={designs}
      />

      <ScreenshotAreaOverlay
        captureRef={captureRef}
        onCapture={screenshot.captureArea}
      />

      {/*
        Off-screen Sandpack instance the agent's `screenshotDesign` tool 
        drives when the user is looking at a different design.
      */}
      <ScreenshotHost
        projectId={project.id}
        designs={designs}
        preWarmDesignId={preWarmDesignId}
      />

      <DrawingShapeBar
        projectId={project.id}
        viewportRef={viewportRef}
        onSend={drawingSend.send}
        sending={drawingSend.sending}
        onRequestExit={exitDrawing.requestExit}
      />

      <ConfirmDialog
        open={exitDrawing.confirmOpen}
        onOpenChange={exitDrawing.setConfirmOpen}
        title="Discard sketch?"
        description="Exiting Draw mode will clear all of your in-progress drawings. This can't be undone."
        confirmLabel="Discard sketch"
        cancelLabel="Keep drawing"
        tone="destructive"
        onConfirm={exitDrawing.confirmExit}
      />
    </div>
  );
}
