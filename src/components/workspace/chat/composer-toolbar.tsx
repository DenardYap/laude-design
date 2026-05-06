"use client";

import { Paperclip, SendHorizonal, Square } from "lucide-react";

import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  EMPTY_ATTACHMENTS,
  EMPTY_TAGS,
  useWorkspaceStore,
} from "@/stores/workspace-store";
import { ContextUsageIndicator } from "@/components/workspace/chat/context-usage-indicator";
import { ModelPicker } from "@/components/workspace/chat/model-picker";
import { SelfCritiqueToggle } from "@/components/workspace/chat/self-critique-toggle";
import type { ComposerToolbarProps } from "@/components/workspace/chat/types/composer";

export function ComposerToolbar({
  projectId,
  sessionId,
  uploadPending,
  fileInputRef,
  onSend,
}: ComposerToolbarProps) {
  const streaming = useWorkspaceStore(
    (s) => Boolean(s.streamingSessionIds[sessionId]),
  );
  const draft = useWorkspaceStore((s) => s.draftBySession[sessionId] ?? "");
  const pending = useWorkspaceStore(
    (s) => s.pendingAttachmentsBySession[sessionId] ?? EMPTY_ATTACHMENTS,
  );
  const pendingTags = useWorkspaceStore(
    (s) => s.pendingTagsBySession[sessionId] ?? EMPTY_TAGS,
  );
  const requestSessionStop = useWorkspaceStore((s) => s.requestSessionStop);

  const canSend =
    !uploadPending &&
    (draft.trim().length > 0 || pending.length > 0 || pendingTags.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
      <ContextUsageIndicator projectId={projectId} sessionId={sessionId} />
      <div className="flex flex-1 items-center justify-end gap-1">
        <ModelPicker projectId={projectId} sessionId={sessionId} />
        <SelfCritiqueToggle sessionId={sessionId} disabled={streaming} />
        <IconButton
          aria-label="Attach files"
          className="size-7"
          icon={<Paperclip className="size-3.5" />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadPending}
        />
        {streaming ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                aria-label="Stop generating"
                variant="primary"
                className="size-8 rounded-full sm:size-7"
                icon={<Square className="size-3 fill-current" />}
                onClick={() => requestSessionStop(sessionId)}
              />
            </TooltipTrigger>
            <TooltipContent side="top">Stop generating</TooltipContent>
          </Tooltip>
        ) : (
          <IconButton
            aria-label="Send message"
            variant="primary"
            className="size-8 rounded-full sm:size-7"
            icon={<SendHorizonal className="size-3.5" />}
            onClick={onSend}
            disabled={!canSend}
          />
        )}
      </div>
    </div>
  );
}
