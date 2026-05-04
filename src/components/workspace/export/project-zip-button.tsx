"use client";

import { useState } from "react";
import { FolderArchive } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import {
  buildProjectZip,
  suggestedZipName,
} from "@/components/workspace/export/utils/build-project-zip";
import type { ProjectZipButtonProps } from "@/components/workspace/export/types/export";

export function ProjectZipButton({ projectName, folders, designs }: ProjectZipButtonProps) {
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
