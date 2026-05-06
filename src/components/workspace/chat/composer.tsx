"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { RefObject } from "react";
import type { FileUIPart } from "ai";

import { Textarea } from "@/components/ui";
import {
  EMPTY_ATTACHMENTS,
  EMPTY_TAGS,
  useWorkspaceStore,
} from "@/stores/workspace-store";
import { ComposerAttachmentsStrip } from "@/components/workspace/chat/composer-attachments-strip";
import { ComposerToolbar } from "@/components/workspace/chat/composer-toolbar";
import {
  buildScreenshotContextNote,
  buildSketchContextNote,
} from "@/lib/workspace/internal-notes";
import { buildTagMarker } from "@/lib/workspace/tag-markers";
import type {
  ComposerHandle,
  ComposerProps,
  ComposerSendParts,
} from "@/components/workspace/chat/types/composer";
import { isLikelyOnScreenKeyboard } from "@/components/workspace/chat/utils/device";

export type { ComposerSendParts, ComposerHandle };

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer(
    { projectId, sessionId, onSend, uploadFiles, uploadPending },
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
      if (streaming || uploadPending) return;

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
          <ComposerAttachmentsStrip
            sessionId={sessionId}
            uploadPending={uploadPending}
          />

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
            uploadPending={uploadPending}
            fileInputRef={fileInputRef}
            onSend={handleSend}
          />
        </div>
      </div>
    );
  },
);
