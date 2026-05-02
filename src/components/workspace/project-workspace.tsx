"use client";

import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import type {
  ApiKeySummary,
  ChatSessionDTO,
  DesignDTO,
  FolderDTO,
} from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ChatPane } from "@/components/workspace/chat/chat-pane";
import {
  CanvasPane,
  CanvasHeader,
} from "@/components/workspace/canvas/canvas-pane";
import { SessionTabs } from "@/components/workspace/chat/session-tabs";
import { useCanvasScreenshot } from "@/components/workspace/canvas/use-screenshot";
import { ScreenshotAreaOverlay } from "@/components/workspace/canvas/screenshot-area-overlay";
import { DrawingShapeBar } from "@/components/workspace/canvas/drawing/drawing-shape-bar";
import { useDrawingSend } from "@/components/workspace/canvas/drawing/use-drawing-send";
import { useExitDrawing } from "@/components/workspace/canvas/drawing/use-exit-drawing";
import { ConfirmDialog } from "@/components/ui";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { CommandPalette } from "@/components/workspace/command-palette/command-palette";
import { ExportToAgentDialog } from "@/components/workspace/export/export-to-agent-dialog";
import { useCmdKShortcut } from "@/components/workspace/command-palette/use-cmd-k-shortcut";

interface ProjectWorkspaceProps {
  project: { id: string; name: string };
  sessions: ChatSessionDTO[];
  folders: FolderDTO[];
  designs: DesignDTO[];
  apiKeys: ApiKeySummary[];
  user: { name: string | null; email: string | null; image: string | null };
  allProjects: { id: string; name: string }[];
}

export function ProjectWorkspace({
  project,
  sessions,
  folders,
  designs,
  apiKeys,
  user,
  allProjects,
}: ProjectWorkspaceProps) {
  const rawChatPanelSize = useWorkspaceStore((s) => s.chatPanelSize);
  const setChatPanelSize = useWorkspaceStore((s) => s.setChatPanelSize);
  const hydrateSessionUsage = useWorkspaceStore((s) => s.hydrateSessionUsage);

  // Server is authoritative on usage stats. Refold the persisted DB values
  // into the store on every mount + whenever the session list changes (e.g.
  // a router.refresh() arrives with fresh totals after a turn finishes).
  React.useEffect(() => {
    hydrateSessionUsage(sessions);
  }, [sessions, hydrateSessionUsage]);
  // Guard against corrupted persisted values. Clamp to the allowed [25, 50] range.
  const chatPanelPercent =
    typeof rawChatPanelSize === "number" &&
    isFinite(rawChatPanelSize) &&
    rawChatPanelSize > 0
      ? Math.min(50, Math.max(25, rawChatPanelSize))
      : 30;
  useCmdKShortcut();

  // Capture target lives in the canvas body, but the screenshot button lives
  // in the canvas header, and the drag-to-select overlay lives at the
  // workspace level. Hoist both ref and the screenshot callbacks here so all
  // three can share them. The viewportRef is the scrollable parent — the
  // Draw tool screenshots only what the user can see, so it captures from
  // there instead of the full scaled `captureRef` interior.
  const captureRef = React.useRef<HTMLDivElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const screenshot = useCanvasScreenshot(project.id, captureRef);
  const drawingSend = useDrawingSend(project.id, viewportRef, captureRef);
  const exitDrawing = useExitDrawing(project.id);

  const canvasPanelPercent = 100 - chatPanelPercent;

  // Closing every tab is a valid empty state, so we don't fall back to
  // sessions[0] here. The session-tabs component handles first-visit hydration.
  const activeSessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[project.id],
  );

  return (
    <div className="flex h-screen w-screen flex-col bg-background ">
      <WorkspaceHeader
        projectId={project.id}
        projectName={project.name}
        user={user}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="grid h-10 shrink-0"
          style={{
            gridTemplateColumns: `${chatPanelPercent}fr ${canvasPanelPercent}fr`,
          }}
        >
          <div className="min-w-0 bg-surface ">
            <SessionTabs
              projectId={project.id}
              sessions={sessions}
              activeSessionId={activeSessionId}
            />
          </div>
          <div className="min-w-0 ">
            <CanvasHeader
              projectId={project.id}
              designs={designs}
              onCaptureFull={screenshot.captureFull}
              onStartAreaCapture={screenshot.startAreaCapture}
              onRequestSwitch={exitDrawing.requestSwitch}
            />
          </div>
        </div>
        <Group
          orientation="horizontal"
          id={`workspace-${project.id}`}
          className="min-h-0 flex-1 "
        >
          <Panel
            id="chat"
            defaultSize={`${chatPanelPercent}%`}
            minSize="25%"
            maxSize="50%"
            onResize={(size) => setChatPanelSize(size.asPercentage)}
            className="flex min-w-0 flex-col bg-surface"
          >
            <ChatPane
              projectId={project.id}
              sessions={sessions}
              apiKeys={apiKeys}
            />
          </Panel>
          <Separator className="w-1.5cursor-col-resize focus:outline-none focus-visible:outline-none" />
          <Panel id="canvas" className="flex min-w-0 flex-col">
            <CanvasPane
              projectId={project.id}
              projectName={project.name}
              folders={folders}
              designs={designs}
              captureRef={captureRef}
              viewportRef={viewportRef}
            />
          </Panel>
        </Group>
      </div>

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
