"use client";

import { useEffect, useMemo, useState } from 'react';
import { FolderArchive } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ImageExportTab } from "@/components/workspace/export/image-export-tab";
import { PromptExportTab } from "@/components/workspace/export/prompt-export-tab";
import { useDesignScreenshotCapture } from "@/components/workspace/export/use-design-screenshot-capture";
import {
  buildProjectZip,
  suggestedZipName,
} from "@/components/workspace/export/build-project-zip";

type ExportMode = "image" | "prompt";

interface ExportToAgentDialogProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
}

interface ActiveExportProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  design: DesignDTO;
  designs: DesignDTO[];
  mode: ExportMode;
  onModeChange: (m: ExportMode) => void;
  onPickDesign: (id: string) => void;
}

function ProjectZipButton({
  projectName,
  folders,
  designs,
}: {
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
}) {
  const [pending, setPending] = useState(false);

  async function handleDownload() {
    if (pending) return;
    setPending(true);
    try {
      const blob = await buildProjectZip({ projectName, folders, designs });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedZipName(projectName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${a.download}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't build zip");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={pending}
      className="gap-1 text-xs"
    >
      <FolderArchive className="size-3.5" />
      {pending ? "Zipping…" : "Download project .zip"}
    </Button>
  );
}

/**
 * The body of the dialog when at least one design exists. Pulled out so the
 * Sandpack preview (which lives in `ImageExportTab`) only mounts while the
 * dialog is open AND a design is selected — not on every render of the
 * outer component tree.
 */
function ActiveExport({
  projectId,
  projectName,
  folders,
  design,
  designs,
  mode,
  onModeChange,
  onPickDesign,
}: ActiveExportProps) {
  const { status, captureAsync, recapture } = useDesignScreenshotCapture(
    projectId,
    design.id,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              Design: <span className="ml-1 font-semibold">{design.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {designs.map((d) => (
              <DropdownMenuItem key={d.id} onSelect={() => onPickDesign(d.id)}>
                {d.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ProjectZipButton
          projectName={projectName}
          folders={folders}
          designs={designs}
        />
      </div>

      <Tabs value={mode} onValueChange={(v) => onModeChange(v as ExportMode)}>
        <TabsList>
          <TabsTrigger value="image">Image</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
        </TabsList>
        <TabsContent value="image">
          <ImageExportTab
            design={design}
            status={status}
            onRetry={recapture}
            captureAsync={captureAsync}
          />
        </TabsContent>
        <TabsContent value="prompt">
          <PromptExportTab design={design} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
