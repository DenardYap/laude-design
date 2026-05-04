"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { RefObject } from "react";
import { Paperclip, SendHorizonal, Square } from "lucide-react";
import type { FileUIPart } from "ai";

import {
  IconButton,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { type UploadedFile } from "@/lib/api/uploads";
import {
  EMPTY_ATTACHMENTS,
  EMPTY_TAGS,
  useWorkspaceStore,
} from "@/stores/workspace-store";
import { ContextUsageIndicator } from "@/components/workspace/chat/context-usage-indicator";
import { ModelPicker } from "@/components/workspace/chat/model-picker";
import { SelfCritiqueToggle } from "@/components/workspace/chat/self-critique-toggle";
import { TagChip } from "@/components/workspace/chat/tag-chip";
import { AttachmentChip } from "@/components/workspace/chat/attachment-chip";
import {
  buildScreenshotContextNote,
  buildSketchContextNote,
} from "@/lib/workspace/internal-notes";
import { buildTagMarker } from "@/lib/workspace/tag-markers";
import type {
  ComposerHandle,
  ComposerProps,
  ComposerSendParts,
  ComposerToolbarProps,
} from "@/components/workspace/chat/types/composer";

export type { ComposerSendParts, ComposerHandle };

// Heuristic: most mobile browsers report `(pointer: coarse)` and don't have
// a physical keyboard attached, so an Enter press there is almost always the
// on-screen "return" key intended to insert a newline. Desktop (pointer: fine)
// treats Enter as send, matching every other chat client.
const isLikelyOnScreenKeyboard = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
};

// ---------------------------------------------------------------------------
// ComposerAttachmentsStrip — reads directly from store; no prop drilling
// ---------------------------------------------------------------------------

function ComposerAttachmentsStrip({ sessionId }: { sessionId: string }) {
  const pending = useWorkspaceStore(
    (s) => s.pendingAttachmentsBySession[sessionId] ?? EMPTY_ATTACHMENTS,
  );
  const pendingTags = useWorkspaceStore(
    (s) => s.pendingTagsBySession[sessionId] ?? EMPTY_TAGS,
  );
  const removeAttachment = useWorkspaceStore((s) => s.removePendingAttachment);
  const removeTag = useWorkspaceStore((s) => s.removePendingTag);

  if (pending.length === 0 && pendingTags.length === 0) return null;

  return (
    <div className="scrollbar-hide max-h-[120px] overflow-y-auto px-2 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        {pendingTags.map((t) => (
          <TagChip
            key={t.id}
            tag={t}
            onRemove={() => removeTag(sessionId, t.id)}
          />
        ))}
        {pending.map((a: UploadedFile) => (
          <AttachmentChip
            key={a.url}
            file={a}
            onRemove={() => removeAttachment(sessionId, a.url)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComposerToolbar — reads streaming/canSend/stop directly from store
// ---------------------------------------------------------------------------

function ComposerToolbar({
  projectId,
  sessionId,
  apiKeys,
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
    draft.trim().length > 0 || pending.length > 0 || pendingTags.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
      <ContextUsageIndicator projectId={projectId} sessionId={sessionId} />
      <div className="flex flex-1 items-center justify-end gap-1">
        <ModelPicker
          projectId={projectId}
          sessionId={sessionId}
          apiKeys={apiKeys}
        />
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

// ---------------------------------------------------------------------------
// Composer — public API
// ---------------------------------------------------------------------------

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer(
    { projectId, sessionId, apiKeys, onSend, uploadFiles, uploadPending },
    ref,
  ) {
    const draft = useWorkspaceStore((s) => s.draftBySession[sessionId] ?? "");
    const setDraft = useWorkspaceStore((s) => s.setDraft);
    const pending = useWorkspaceStore(
      (s) => s.pendingAttachmentsBySession[sessionId] ?? EMPTY_ATTACHMENTS,
    );
    const clearAttachments = useWorkspaceStore((s) => s.clearPendingAttachments);
    const pendingTags = useWorkspaceStore(
      (s) => s.pendingTagsBySession[sessionId] ?? EMPTY_TAGS,
    );
    const clearTags = useWorkspaceStore((s) => s.clearPendingTags);
    const streaming = useWorkspaceStore(
      (s) => Boolean(s.streamingSessionIds[sessionId]),
    );

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    function handleSend() {
      const text = draft.trim();
      if (!text && pending.length === 0 && pendingTags.length === 0) return;
      if (streaming) return;

      const fileParts: FileUIPart[] = pending.map((a) => ({
        type: "file",
        mediaType: a.mimeType,
        url: a.url,
        filename: a.name,
      }));

      const screenshotCount = pending.filter(
        (a) => a.kind === "screenshot",
      ).length;
      const sketchCount = pending.filter((a) => a.kind === "sketch").length;
      const screenshotNote = buildScreenshotContextNote(screenshotCount);
      const sketchNote = buildSketchContextNote(sketchCount);

      const tagParts: ComposerSendParts = pendingTags.map((t) => ({
        type: "text",
        text: buildTagMarker({ selector: t.selector, text: t.text }),
      }));

      const parts: ComposerSendParts = [];
      if (screenshotNote) parts.push({ type: "text", text: screenshotNote });
      if (sketchNote) parts.push({ type: "text", text: sketchNote });
      parts.push(...tagParts);
      if (text) parts.push({ type: "text", text });
      parts.push(...fileParts);

      onSend(parts);
      setDraft(sessionId, "");
      clearAttachments(sessionId);
      clearTags(sessionId);
    }

    return (
      <div className="px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-3 sm:pb-3">
        <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-colors">
          <ComposerAttachmentsStrip sessionId={sessionId} />

          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(sessionId, e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !isLikelyOnScreenKeyboard()
              ) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type something..."
            rows={2}
            className="min-h-[56px] resize-none border-0 bg-transparent px-3 py-2 text-base shadow-none focus-visible:ring-0 sm:text-sm"
          />

          <input
            ref={fileInputRef as RefObject<HTMLInputElement>}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) uploadFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />

          <ComposerToolbar
            projectId={projectId}
            sessionId={sessionId}
            apiKeys={apiKeys}
            uploadPending={uploadPending}
            fileInputRef={fileInputRef}
            onSend={handleSend}
          />
        </div>
      </div>
    );
  },
);
