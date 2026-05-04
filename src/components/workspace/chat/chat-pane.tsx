"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { ChatPaneProps } from "@/components/workspace/chat/types/messages";
import { TEMP_SESSION_PREFIX } from "@/components/workspace/chat/session-tabs";
import {
  Composer,
  type ComposerHandle,
  type ComposerSendParts,
} from "@/components/workspace/chat/composer";
import { uploadAttachment } from "@/lib/api/uploads";
import { useFileDrop } from "@/components/workspace/chat/hooks/use-file-drop";
import { cn } from "@/lib/utils";
import { ActiveSessionLoader } from "@/components/workspace/chat/active-session-loader";
import { ChatSessionSkeleton } from "@/components/workspace/chat/chat-session-skeleton";

/**
 * Sentinel session id the Composer binds to during the imperceptible
 * single-frame window between "ChatPane mounts with no active session" and
 * "auto-create kicks in". Drafts written here are practically unreachable
 * (no human types in 16ms), so we don't bother migrating them.
 */
const COMPOSER_NO_SESSION_KEY = "__chatbox_no_session__";

/**
 * Keeps a single Composer permanently mounted at the bottom of the chat pane.
 * Sends are queued through the workspace store and consumed by whichever
 * `ActiveSession` matches the queue's session id — so the chatbox never
 * unmounts when the active session id swings (temp→real handoff, tab swap,
 * SSR-prop lag, useQuery isPending, etc).
 */
export function ChatPane({ projectId, apiKeys, hasSessions = false }: ChatPaneProps) {
  const activeSessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[projectId],
  );
  const openSessionIds = useWorkspaceStore(
    (s) => s.openSessionsByProject[projectId] ?? [],
  );
  const seedSessionModel = useWorkspaceStore((s) => s.seedSessionModel);
  const addAttachment = useWorkspaceStore((s) => s.addPendingAttachment);

  // Seed the model for every open session that doesn't have one yet.
  useEffect(() => {
    for (const id of openSessionIds) {
      seedSessionModel(projectId, id);
    }
  }, [openSessionIds, projectId, seedSessionModel]);

  const mountableIds = openSessionIds.filter(
    (id) => !id.startsWith(TEMP_SESSION_PREFIX),
  );

  const composerSessionId = activeSessionId ?? COMPOSER_NO_SESSION_KEY;

  const isStreaming = useWorkspaceStore((s) =>
    Boolean(activeSessionId && s.streamingSessionIds[activeSessionId]),
  );

  const composerRef = useRef<ComposerHandle>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadAttachment(projectId, file),
    onSuccess: (file) => addAttachment(composerSessionId, file),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const handleValidFiles = useCallback(
    (files: File[]) => {
      files.forEach((f) => upload.mutate(f));
    },
    [upload],
  );

  const { dragOver, dragHandlers } = useFileDrop({ onValidFiles: handleValidFiles });

  // Focus the chatbox whenever the active session changes.
  useEffect(() => {
    if (!activeSessionId) return;
    composerRef.current?.focus();
  }, [activeSessionId]);

  const enqueueComposerSubmission = useWorkspaceStore(
    (s) => s.enqueueComposerSubmission,
  );
  const requestSessionStop = useWorkspaceStore((s) => s.requestSessionStop);

  const handleSend = useCallback(
    (parts: ComposerSendParts) => {
      if (!activeSessionId) return;
      enqueueComposerSubmission(activeSessionId, parts);
    },
    [activeSessionId, enqueueComposerSubmission],
  );

  const handleStop = useCallback(() => {
    if (!activeSessionId) return;
    requestSessionStop(activeSessionId);
  }, [activeSessionId, requestSessionStop]);

  const hasActiveMountable =
    !!activeSessionId && mountableIds.includes(activeSessionId);

  return (
    <div className="relative flex h-full min-h-0 flex-col" {...dragHandlers}>
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-10 py-8",
              "border-brand bg-brand-soft/40",
            )}
          >
            <UploadCloud className="size-8 text-brand" />
            <p className="text-sm font-semibold text-foreground">Drop files here</p>
            <p className="text-xs text-ink-muted">Images · PDF · TXT · Markdown · CSV</p>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {mountableIds.map((sessionId) => (
          <ActiveSessionLoader
            key={sessionId}
            projectId={projectId}
            sessionId={sessionId}
            active={sessionId === activeSessionId}
          />
        ))}
        {!hasActiveMountable &&
          (hasSessions ? (
            <ChatSessionSkeleton />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-ink-muted">
              Start chatting with your agent.
            </div>
          ))}
      </div>
      <Composer
        ref={composerRef}
        projectId={projectId}
        sessionId={composerSessionId}
        apiKeys={apiKeys}
        streaming={isStreaming}
        onSend={handleSend}
        onStop={handleStop}
        uploadFiles={handleValidFiles}
        uploadPending={upload.isPending}
      />
    </div>
  );
}
