"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui";
import { UserMenu } from "@/components/layout/user-menu";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { renameProject } from "@/server/actions/projects";
import { ProjectSkillsDialog } from "@/components/workspace/skills/project-skills-dialog";

interface WorkspaceHeaderProps {
  projectId: string;
  projectName: string;
  user: { name: string | null; email: string | null; image: string | null };
}

export function WorkspaceHeader({ projectId, projectName, user }: WorkspaceHeaderProps) {
  const setExportOpen = useWorkspaceStore((s) => s.setExportOpen);
  const [skillsOpen, setSkillsOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-surface px-2 sm:px-4 sm:gap-3">
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <Link href="/projects" aria-label="Back to projects">
          <IconButton aria-label="Back to projects" icon={<ArrowLeft className="size-4" />} />
        </Link>
        <ProjectTitle projectId={projectId} projectName={projectName} />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full px-2 sm:px-3"
          onClick={() => setSkillsOpen(true)}
          aria-label="Skills"
        >
          <Sparkles className="size-3.5" />
          <span className="hidden sm:inline">Skills</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="rounded-full px-2 sm:px-3"
          onClick={() => setExportOpen(true)}
        >
          <span className="hidden sm:inline">Export to Agent</span>
          <span className="sm:hidden">Export</span>
        </Button>
        <UserMenu user={user} size="sm" />
      </div>

      <ProjectSkillsDialog
        projectId={projectId}
        open={skillsOpen}
        onOpenChange={setSkillsOpen}
      />
    </header>
  );
}

interface ProjectTitleProps {
  projectId: string;
  projectName: string;
}

function ProjectTitle({ projectId, projectName }: ProjectTitleProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Optimistic name lets the new title render immediately while the server
  // catches up — otherwise the input flashes back to the old name on blur.
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOptimisticName(null);
  }, [projectName]);

  const displayName = optimisticName ?? projectName;

  const rename = useMutation({
    mutationFn: (name: string) => renameProject(projectId, name),
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
    onError: (e) => {
      setOptimisticName(null);
      setEditing(true);
      toast.error(e instanceof Error ? e.message : "Failed to rename project");
    },
  });

  const startEditing = useCallback(() => {
    setDraft(displayName);
    setEditing(true);
  }, [displayName]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === displayName) {
      setEditing(false);
      setDraft(displayName);
      return;
    }
    setOptimisticName(trimmed);
    setEditing(false);
    rename.mutate(trimmed);
  }, [draft, displayName, rename]);

  const cancel = useCallback(() => {
    setDraft(displayName);
    setEditing(false);
  }, [displayName]);

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        maxLength={80}
        aria-label="Project name"
        className="min-w-0 max-w-[140px] truncate rounded-md bg-surface-sunken px-1.5 py-0.5 text-sm font-semibold tracking-tight text-ink outline-none ring-2 ring-ring sm:max-w-[280px]"
      />
    );
  }

  return (
    <h1
      role="button"
      tabIndex={0}
      onDoubleClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          startEditing();
        }
      }}
      title="Double-click to rename"
      className="-mx-1.5 max-w-[140px] truncate rounded-md px-1.5 py-0.5 text-sm font-semibold tracking-tight text-ink hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-none"
    >
      {displayName}
    </h1>
  );
}
