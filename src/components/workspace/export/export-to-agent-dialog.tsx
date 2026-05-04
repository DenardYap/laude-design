"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ActiveExport } from "@/components/workspace/export/active-export";
import type {
  ExportMode,
  ExportToAgentDialogProps,
} from "@/components/workspace/export/types/export";

export function ExportToAgentDialog({
  projectId,
  projectName,
  folders,
  designs,
}: ExportToAgentDialogProps) {
  const open = useWorkspaceStore((s) => s.exportOpen);
  const setOpen = useWorkspaceStore((s) => s.setExportOpen);
  const activeTab = useWorkspaceStore((s) => s.activeTabByProject[projectId] ?? "files");

  const initialDesignId = useMemo(() => {
    if (activeTab.startsWith("design:")) return activeTab.replace(/^design:/, "");
    return designs[0]?.id ?? null;
  }, [activeTab, designs]);

  const [chosenId, setChosenId] = useState<string | null>(initialDesignId);
  const [mode, setMode] = useState<ExportMode>("image");

  useEffect(() => {
    setChosenId(initialDesignId);
  }, [initialDesignId, open]);

  const design = designs.find((d) => d.id === chosenId) ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export to your favorite agent</DialogTitle>
          <DialogDescription>
            Drop the design straight into Claude, ChatGPT, Cursor, or Codex —
            either as a pixel-perfect image or as a self-contained code prompt.
          </DialogDescription>
        </DialogHeader>

        {designs.length === 0 || !design ? (
          <div className="rounded-md border border-dashed border-border bg-surface-sunken/40 p-6 text-center text-sm text-ink-muted">
            No designs in this project yet. Create one to export.
          </div>
        ) : (
          <ActiveExport
            projectId={projectId}
            projectName={projectName}
            folders={folders}
            design={design}
            designs={designs}
            mode={mode}
            onModeChange={setMode}
            onPickDesign={setChosenId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
