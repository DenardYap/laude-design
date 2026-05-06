"use client";

import { useCallback, useEffect, useRef } from "react";

import { EMPTY_TAB_LIST, useWorkspaceStore } from "@/stores/workspace-store";
import type { ChatPaneProps } from "@/components/workspace/chat/types/messages";
import { TEMP_SESSION_PREFIX } from "@/components/workspace/chat/utils/session-constants";
import {
  Composer,
  type ComposerHandle,
  type ComposerSendParts,
} from "@/components/workspace/chat/composer";
import { useUploadAttachment } from "@/components/workspace/chat/hooks/use-upload-attachment";
import { useFileDrop } from "@/components/workspace/chat/hooks/use-file-drop";
import { DropOverlay } from "@/components/workspace/chat/drop-overlay";
import { ActiveSessionLoader } from "@/components/workspace/chat/active-session-loader";
import { ChatSessionSkeleton } from "@/components/workspace/chat/chat-session-skeleton";

const COMPOSER_NO_SESSION_KEY = "__chatbox_no_session__";

export function ChatPane({ projectId, hasSessions = false }: ChatPaneProps) {
  const activeSessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[projectId],
  );
  const openSessionIds = useWorkspaceStore(
    (s) => s.openSessionsByProject[projectId] ?? EMPTY_TAB_LIST,
  );
  const seedSessionModel = useWorkspaceStore((s) => s.seedSessionModel);
  const enqueueComposerSubmission = useWorkspaceStore(
    (s) => s.enqueueComposerSubmission,
  );

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
  const composerRef = useRef<ComposerHandle>(null);

  const upload = useUploadAttachment(projectId, composerSessionId);

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

  const handleSend = useCallback(
    (parts: ComposerSendParts) => {
      if (!activeSessionId) return;
      enqueueComposerSubmission(activeSessionId, parts);
    },
    [activeSessionId, enqueueComposerSubmission],
  );

  const hasActiveMountable =
    !!activeSessionId && mountableIds.includes(activeSessionId);

  return (
    <div className="relative flex h-full min-h-0 flex-col" {...dragHandlers}>
      {dragOver && <DropOverlay />}

      <div className="flex min-h-0 flex-1 flex-col">
        {mountableIds.map((sessionId) => (
          <ActiveSessionLoader
            key={sessionId}
            projectId={projectId}
            sessionId={sessionId}
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
        onSend={handleSend}
        uploadFiles={handleValidFiles}
        uploadPending={upload.isPending}
      />
    </div>
  );
}
