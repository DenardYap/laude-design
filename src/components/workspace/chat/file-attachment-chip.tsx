"use client";

import { Paperclip, X } from "lucide-react";

import type { AttachmentChipProps } from "@/components/workspace/chat/types/misc";

export function FileAttachmentChip({ file, onRemove }: AttachmentChipProps) {
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
