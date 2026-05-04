"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Group, Panel, Separator } from "react-resizable-panels";
import { LayoutDashboard, MessageSquare } from "lucide-react";

import type {
  ApiKeySummary,
  ChatSessionDTO,
  DesignDTO,
  FolderDTO,
} from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useRecentsStore } from "@/stores/recents-store";
import {
  applyOptimisticOverlays,
  useOptimisticFilesStore,
} from "@/stores/optimistic-files-store";
import { ChatPane } from "@/components/workspace/chat/chat-pane";
import {
  CanvasPane,
  CanvasHeader,
} from "@/components/workspace/canvas/canvas-pane";
import { SessionTabs } from "@/components/workspace/chat/session-tabs";
import { useCanvasScreenshot } from "@/components/workspace/canvas/use-screenshot";
import { ScreenshotAreaOverlay } from "@/components/workspace/canvas/screenshot-area-overlay";
import { ScreenshotHost } from "@/components/workspace/canvas/screenshot-host";
import { DrawingShapeBar } from "@/components/workspace/canvas/drawing/drawing-shape-bar";
import { useDrawingSend } from "@/components/workspace/canvas/drawing/use-drawing-send";
import { useExitDrawing } from "@/components/workspace/canvas/drawing/use-exit-drawing";
import { ConfirmDialog } from "@/components/ui";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { CommandPalette } from "@/components/workspace/command-palette/command-palette";
import { ExportToAgentDialog } from "@/components/workspace/export/export-to-agent-dialog";
import { useCmdKShortcut } from "@/components/workspace/command-palette/use-cmd-k-shortcut";
import { useIsDesktop } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/**
 * Which surface fills the screen on mobile. The desktop layout shows both
 * panes side-by-side via the resizable group, so this only matters below
 * the `md` breakpoint. Defaults to "chat" because the primary use case
 * for someone on a phone is prompting the agent — not poking around the
 * Sandpack-rendered canvas with their thumb.
 */
type MobileView = "chat" | "canvas";

interface ProjectWorkspaceProps {
  project: { id: string; name: string };
  sessions: ChatSessionDTO[];
  folders: FolderDTO[];
  designs: DesignDTO[];
  apiKeys: ApiKeySummary[];
  user: { name: string | null; email: string | null; image: string | null };
  allProjects: { id: string; name: string }[];
  /**
   * Server-side guess at whether the request is from a desktop-class
   * device, sourced from `getServerViewport()`. Used as the SSR/hydration
   * default for `useIsDesktop` so desktop refreshes don't flash the
   * mobile tab switcher for a frame before hydration corrects it.
   */
  ssrIsDesktop: boolean;
}

export function ProjectWorkspace({
  project,
  sessions,
  folders: serverFolders,
  designs: serverDesigns,
  apiKeys,
  user,
  allProjects,
  ssrIsDesktop,
}: ProjectWorkspaceProps) {
  const rawChatPanelSize = useWorkspaceStore((s) => s.chatPanelSize);
  const setChatPanelSize = useWorkspaceStore((s) => s.setChatPanelSize);
  const hydrateSessionUsage = useWorkspaceStore((s) => s.hydrateSessionUsage);
  const addRecent = useRecentsStore((s) => s.addRecent);

  // Ephemeral optimistic overlay on top of the server tree. Creating /
  // renaming / deleting folders + designs writes here synchronously so the
  // UI updates within a frame — without this, users stare at an unchanged
  // file tree for up to 3s while `server action → revalidatePath →
  // router.refresh → re-render` completes.
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

  // Whenever fresh server data lands, drop overlays whose state is now
  // reflected on the server. This is what lets mutations be fire-and-forget:
  // the mutation sets the overlay, router.refresh() eventually arrives with
  // the real data, and this effect cleans up the staging area.
  useEffect(() => {
    reconcileOptimisticFiles({ serverFolders, serverDesigns });
  }, [serverFolders, serverDesigns, reconcileOptimisticFiles]);

  // Server is authoritative on usage stats. Refold the persisted DB values
  // into the store on every mount + whenever the session list changes (e.g.
  // a router.refresh() arrives with fresh totals after a turn finishes).
  useEffect(() => {
    hydrateSessionUsage(sessions);
  }, [sessions, hydrateSessionUsage]);

  // Record this project visit so it surfaces in the global ⌘K palette's
  // "Recently used" group. Re-runs only when the project identity/name
  // changes — sub-second timestamp churn would be wasteful and could thrash
  // localStorage on rapid renames.
  useEffect(() => {
    addRecent({ kind: "project", id: project.id, name: project.name });
  }, [project.id, project.name, addRecent]);
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
  const captureRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const screenshot = useCanvasScreenshot(project.id, captureRef);
  const drawingSend = useDrawingSend(project.id, viewportRef, captureRef);
  const exitDrawing = useExitDrawing(project.id);

  const canvasPanelPercent = 100 - chatPanelPercent;

  // Closing every tab is a valid empty state, so we don't fall back to
  // sessions[0] here. The session-tabs component handles first-visit hydration.
  const activeSessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[project.id],
  );

  // Tracks which pane fills the mobile viewport. Local state because it's
  // ephemeral — there's no value in persisting it across reloads, and the
  // store doesn't otherwise care which pane is visible (the canvas mounts
  // anyway so the agent's screenshot tool keeps working). Defaults to
  // "chat" so a phone user lands directly on the prompt composer.
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const isDesktop = useIsDesktop(ssrIsDesktop);

  // Build the pane content once so we can place the same instances inside
  // either layout. The chat surface is always the same DOM (no separate
  // mobile/desktop trees), which keeps `useChat` state, draft text, and
  // streaming connections stable when the viewport crosses the `md`
  // breakpoint mid-session.
  //
  // Important: both `SessionTabs` and `CanvasHeader` are authored with
  // `h-full` on their outer div so they vertically centre their content
  // inside the explicit `h-10` row the desktop grid gives them. We
  // mirror that h-10 row here on mobile, otherwise `h-full` resolves to
  // "fill the whole pane" and the toolbar slams into the middle of the
  // screen with the canvas/chat body pushed off both ends.
  const chatPane = (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="h-10 shrink-0">
        <SessionTabs
          projectId={project.id}
          sessions={sessions}
          activeSessionId={activeSessionId}
        />
      </div>
      <div className="min-h-0 flex-1">
        <ChatPane projectId={project.id} apiKeys={apiKeys} hasSessions={sessions.length > 0} />
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
          chatPanelPercent={chatPanelPercent}
          canvasPanelPercent={canvasPanelPercent}
          onResizeChat={setChatPanelSize}
          sessionsPane={
            <div className="min-w-0 bg-surface">
              <SessionTabs
                projectId={project.id}
                sessions={sessions}
                activeSessionId={activeSessionId}
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
          chatBody={<ChatPane projectId={project.id} apiKeys={apiKeys} hasSessions={sessions.length > 0} />}
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
        Off-screen Sandpack instance the agent's `screenshotDesign` tool drives
        when the user is looking at a different design. Mounted at workspace
        level (rather than inside CanvasPane) so it survives canvas tab swaps
        and benefits from sticky-mount keepalive across multi-round revision
        sessions. Fully invisible / inert; see `screenshot-host.tsx`.
      */}
      <ScreenshotHost projectId={project.id} designs={designs} />

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

interface DesktopLayoutProps {
  projectId: string;
  chatPanelPercent: number;
  canvasPanelPercent: number;
  onResizeChat: (size: number) => void;
  sessionsPane: ReactNode;
  canvasHeader: ReactNode;
  chatBody: ReactNode;
  canvasBody: ReactNode;
}

function DesktopLayout({
  projectId,
  chatPanelPercent,
  canvasPanelPercent,
  onResizeChat,
  sessionsPane,
  canvasHeader,
  chatBody,
  canvasBody,
}: DesktopLayoutProps) {
  // `defaultSize` must be stable across renders. `react-resizable-panels` v4
  // includes it in the Panel's useLayoutEffect deps, so feeding back the live
  // store value (which `onResize` updates on every pointer move) would
  // unregister + re-register the panel mid-drag and tear down the library's
  // pointer/ResizeObserver setup — breaking the very first drag. Lock it to
  // the value at mount; the library tracks the current size internally
  // afterwards, and the store value is only used to drive the header's
  // gridTemplateColumns and to persist the size across reloads.
  const [initialChatPanelPercent] = useState(() => chatPanelPercent);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="grid h-10 shrink-0"
        style={{
          gridTemplateColumns: `${chatPanelPercent}fr ${canvasPanelPercent}fr`,
        }}
      >
        {sessionsPane}
        {canvasHeader}
      </div>
      <Group
        orientation="horizontal"
        id={`workspace-${projectId}`}
        className="min-h-0 flex-1"
      >
        <Panel
          id="chat"
          defaultSize={`${initialChatPanelPercent}%`}
          minSize="25%"
          maxSize="50%"
          onResize={(size) => onResizeChat(size.asPercentage)}
          className="flex min-w-0 flex-col bg-surface"
        >
          {chatBody}
        </Panel>
        <Separator className="w-1.5 cursor-col-resize bg-transparent    focus:outline-none focus-visible:outline-none " />
        <Panel id="canvas" className="flex min-w-0 flex-col">
          {canvasBody}
        </Panel>
      </Group>
    </div>
  );
}

interface MobileLayoutProps {
  mobileView: MobileView;
  onChangeView: (view: MobileView) => void;
  chatPane: ReactNode;
  canvasPane: ReactNode;
}

/**
 * Single-pane mobile layout with a top-of-screen segmented control to swap
 * between the chat and the live canvas. Both panes stay mounted at all
 * times — only their visibility flips — so the iframe-backed Sandpack
 * preview doesn't have to reboot every time the user peeks at the agent's
 * progress, and any in-flight chat stream survives the swap.
 */
function MobileLayout({
  mobileView,
  onChangeView,
  chatPane,
  canvasPane,
}: MobileLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MobileViewSwitcher value={mobileView} onChange={onChangeView} />
      <div className="relative min-h-0 flex-1">
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            mobileView === "chat" ? "z-10" : "pointer-events-none invisible",
          )}
          aria-hidden={mobileView !== "chat"}
        >
          {chatPane}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            mobileView === "canvas" ? "z-10" : "pointer-events-none invisible",
          )}
          aria-hidden={mobileView !== "canvas"}
        >
          {canvasPane}
        </div>
      </div>
    </div>
  );
}

interface MobileViewSwitcherProps {
  value: MobileView;
  onChange: (view: MobileView) => void;
}

function MobileViewSwitcher({ value, onChange }: MobileViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Workspace view"
      className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-2 py-1.5"
    >
      <SwitcherButton
        active={value === "chat"}
        onClick={() => onChange("chat")}
        icon={<MessageSquare className="size-3.5" />}
        label="Chat"
      />
      <SwitcherButton
        active={value === "canvas"}
        onClick={() => onChange("canvas")}
        icon={<LayoutDashboard className="size-3.5" />}
        label="Canvas"
      />
    </div>
  );
}

function SwitcherButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-brand/40 text-ink"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
