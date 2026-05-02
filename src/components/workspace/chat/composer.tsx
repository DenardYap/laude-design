"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Paperclip, SendHorizonal, Square, X } from "lucide-react";
import { toast } from "sonner";
import type { FileUIPart, UIMessagePart, UIDataTypes, UITools } from "ai";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  IconButton,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { uploadAttachment, type UploadedFile } from "@/lib/api/uploads";
import {
  EMPTY_ATTACHMENTS,
  EMPTY_TAGS,
  useWorkspaceStore,
} from "@/stores/workspace-store";
import { ContextUsageIndicator } from "@/components/workspace/chat/context-usage-indicator";
import { ModelPicker } from "@/components/workspace/chat/model-picker";
import { TagChip } from "@/components/workspace/chat/tag-chip";
import type { ApiKeySummary } from "@/lib/workspace/types";
import {
  buildScreenshotContextNote,
  buildSketchContextNote,
} from "@/lib/workspace/internal-notes";
import { buildTagMarker } from "@/lib/workspace/tag-markers";

export type ComposerSendParts = UIMessagePart<UIDataTypes, UITools>[];

interface ComposerProps {
  projectId: string;
  sessionId: string;
  apiKeys: ApiKeySummary[];
  /** True while a turn is in flight (submitted or streaming). Disables Send / Enter. */
  streaming: boolean;
  onSend: (parts: ComposerSendParts) => void;
  /** Abort the in-flight turn. Required when `streaming` is true. */
  onStop: () => void;
}

export function Composer({
  projectId,
  sessionId,
  apiKeys,
  streaming,
  onSend,
  onStop,
}: ComposerProps) {
  const draft = useWorkspaceStore((s) => s.draftBySession[sessionId] ?? "");
  const setDraft = useWorkspaceStore((s) => s.setDraft);
  const pending = useWorkspaceStore(
    (s) => s.pendingAttachmentsBySession[sessionId] ?? EMPTY_ATTACHMENTS,
  );
  const addAttachment = useWorkspaceStore((s) => s.addPendingAttachment);
  const removeAttachment = useWorkspaceStore((s) => s.removePendingAttachment);
  const clearAttachments = useWorkspaceStore((s) => s.clearPendingAttachments);
  const pendingTags = useWorkspaceStore(
    (s) => s.pendingTagsBySession[sessionId] ?? EMPTY_TAGS,
  );
  const removeTag = useWorkspaceStore((s) => s.removePendingTag);
  const clearTags = useWorkspaceStore((s) => s.clearPendingTags);

  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadAttachment(projectId, file),
    onSuccess: (file) => addAttachment(sessionId, file),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  function uploadAll(files: FileList | File[]) {
    Array.from(files).forEach((f) => upload.mutate(f));
  }

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

    // Hidden context notes: tell the agent how many of the attached files are
    // canvas screenshots vs. hand-drawn sketches. Only emitted while at least
    // one of each is in the pending list — removing all of them before send
    // removes the corresponding note too.
    const screenshotCount = pending.filter(
      (a) => a.kind === "screenshot",
    ).length;
    const sketchCount = pending.filter((a) => a.kind === "sketch").length;
    const screenshotNote = buildScreenshotContextNote(screenshotCount);
    const sketchNote = buildSketchContextNote(sketchCount);

    // Tagged elements travel as their own text parts. The marker is described
    // in the system prompt so the model can read selector + preview text out
    // of the JSON payload; the chat renders these parts as chips, not text.
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
    <div className="px-3 py-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) uploadAll(e.dataTransfer.files);
        }}
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-colors",
          dragOver && "border-brand bg-brand-soft/40",
        )}
      >
        {pending.length > 0 || pendingTags.length > 0 ? (
          <div className="max-h-[120px] overflow-y-auto px-2 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {pendingTags.map((t) => (
                <TagChip
                  key={t.id}
                  tag={t}
                  onRemove={() => removeTag(sessionId, t.id)}
                />
              ))}
              {pending.map((a) => (
                <AttachmentChip
                  key={a.url}
                  file={a}
                  onRemove={() => removeAttachment(sessionId, a.url)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <Textarea
          value={draft}
          onChange={(e) => setDraft(sessionId, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type something..."
          rows={2}
          className="min-h-[56px] resize-none border-0 bg-transparent px-3 py-2 text-sm shadow-none focus-visible:ring-0"
        />

        <div className="flex items-center gap-1 px-2 pb-2">
          <ContextUsageIndicator
            projectId={projectId}
            sessionId={sessionId}
          />
          <div className="flex flex-1 items-center justify-end gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) uploadAll(e.target.files);
                e.target.value = "";
              }}
            />
            <ModelPicker projectId={projectId} apiKeys={apiKeys} />
            <IconButton
              aria-label="Attach files"
              className="size-7"
              icon={<Paperclip className="size-3.5" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
            />
            {streaming ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton
                    aria-label="Stop generating"
                    variant="primary"
                    className="size-7 rounded-full"
                    icon={<Square className="size-3 fill-current" />}
                    onClick={onStop}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">Stop generating</TooltipContent>
              </Tooltip>
            ) : (
              <IconButton
                aria-label="Send message"
                variant="primary"
                className="size-7 rounded-full"
                icon={<SendHorizonal className="size-3.5" />}
                onClick={handleSend}
                disabled={
                  draft.trim().length === 0 &&
                  pending.length === 0 &&
                  pendingTags.length === 0
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttachmentChip({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  const isImage = file.mimeType.startsWith("image/");
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Images render as a visible thumbnail that opens a lightbox on click.
  // Screenshots are the main use case here — a 24px chip preview is too
  // small to recognise what was captured, and clicking the chip should let
  // you confirm the actual image. The filename moves into a tooltip so the
  // chip stays compact.
  if (isImage) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="group relative">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                aria-label={`Preview ${file.name}`}
                className="block overflow-hidden rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.url}
                  alt={file.name}
                  className="h-16 w-auto max-w-[140px] object-cover"
                />
              </button>
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${file.name}`}
                className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-sm opacity-0 transition-opacity hover:bg-surface-sunken group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="whitespace-nowrap text-[11px]">
            {file.name}
          </TooltipContent>
        </Tooltip>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent
            showDefaultClose={false}
            className="w-auto max-w-none gap-0 border-none bg-transparent p-0 shadow-none"
          >
            <DialogTitle className="sr-only">{file.name}</DialogTitle>
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.name}
                className="block max-h-[90vh] max-w-[90vw] rounded-md object-contain shadow-2xl"
              />
              <DialogClose
                aria-label="Close preview"
                className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-ink/70 text-background shadow-lg backdrop-blur transition-colors hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <X className="size-4" />
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="group relative inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1 text-[11px] text-ink">
      <Paperclip className="size-3.5 text-ink-muted" />
      <span className="max-w-[140px] truncate">{file.name}</span>
      <button
        type="button"
        className="opacity-60 hover:opacity-100"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
