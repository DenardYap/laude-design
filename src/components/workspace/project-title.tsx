"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ProjectTitleProps } from "@/components/workspace/types/workspace";
import { useRenameProject } from "@/components/workspace/hooks/use-rename-project";

export function ProjectTitle({ projectId, projectName }: ProjectTitleProps) {
  const [editing, setEditing] = useState(false);
  const [optimisticName, setOptimisticName] = useState<string | null>(null);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOptimisticName(null);
  }, [projectName]);

  const displayName = optimisticName ?? projectName;

  const rename = useRenameProject(projectId, {
    onSuccess: () => setEditing(false),
    onError: () => {
      setOptimisticName(null);
      setEditing(true);
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
