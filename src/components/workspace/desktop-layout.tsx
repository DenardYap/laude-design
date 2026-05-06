"use client";

import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { DesktopLayoutProps } from "@/components/workspace/types/workspace";

export function DesktopLayout({
  projectId,
  sessionsPane,
  canvasHeader,
  chatBody,
  canvasBody,
}: DesktopLayoutProps) {
  const rawChatPanelSize = useWorkspaceStore((s) => s.chatPanelSize);
  const setChatPanelSize = useWorkspaceStore((s) => s.setChatPanelSize);
  const chatPanelPercent =
    typeof rawChatPanelSize === "number" &&
    isFinite(rawChatPanelSize) &&
    rawChatPanelSize > 0
      ? Math.min(50, Math.max(25, rawChatPanelSize))
      : 30;
  const canvasPanelPercent = 100 - chatPanelPercent;
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
          onResize={(size) => setChatPanelSize(size.asPercentage)}
          className="flex min-w-0 flex-col bg-surface"
        >
          {chatBody}
        </Panel>
        <Separator className="w-1.5 cursor-col-resize bg-transparent focus:outline-none focus-visible:outline-none" />
        <Panel id="canvas" className="flex min-w-0 flex-col">
          {canvasBody}
        </Panel>
      </Group>
    </div>
  );
}
