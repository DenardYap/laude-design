"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { type UploadedFile } from "@/lib/api/uploads";
import { ImagePreviewDialog } from "@/components/workspace/chat/image-preview-dialog";

// ---------------------------------------------------------------------------
// ImageAttachmentChip — thumbnail that opens a lightbox on click
// ---------------------------------------------------------------------------
// Screenshots are the main use case: a 24px chip preview is too small to
// recognise what was captured, and clicking should let you confirm the image.
// The filename moves into a tooltip so the chip stays compact.

function ImageAttachmentChip({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
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
      <ImagePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        url={file.url}
        name={file.name}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// FileAttachmentChip — compact paperclip chip for non-image files
// ---------------------------------------------------------------------------

function FileAttachmentChip({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
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

// ---------------------------------------------------------------------------
// AttachmentChip — public API
// ---------------------------------------------------------------------------

export function AttachmentChip({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  if (file.mimeType.startsWith("image/")) {
    return <ImageAttachmentChip file={file} onRemove={onRemove} />;
  }
  return <FileAttachmentChip file={file} onRemove={onRemove} />;
}
