"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { IconButton } from "@/components/ui";
import { ProjectTitle } from "@/components/workspace/project-title";
import type { WorkspaceHeaderNavProps } from "@/components/workspace/types/workspace";

export function WorkspaceHeaderNav({ projectId, projectName }: WorkspaceHeaderNavProps) {
  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <Link href="/projects" aria-label="Back to projects">
        <IconButton aria-label="Back to projects" icon={<ArrowLeft className="size-4" />} />
      </Link>
      <ProjectTitle projectId={projectId} projectName={projectName} />
    </div>
  );
}
