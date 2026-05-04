"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { useDesignScreenshotCapture } from "@/components/workspace/export/hooks/use-design-screenshot-capture";
import { ImageExportTab } from "@/components/workspace/export/image-export-tab";
import { PromptExportTab } from "@/components/workspace/export/prompt-export-tab";
import { ProjectZipButton } from "@/components/workspace/export/project-zip-button";
import type { ActiveExportProps } from "@/components/workspace/export/types/export";

export function ActiveExport({
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

      <Tabs value={mode} onValueChange={(v) => onModeChange(v as typeof mode)}>
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
