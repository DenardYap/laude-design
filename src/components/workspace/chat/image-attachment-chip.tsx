"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import type { AttachmentChipProps } from "@/components/workspace/chat/types/misc";

export function ImageAttachmentChip({ file, onRemove }: AttachmentChipProps) {
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
      {previewOpen && (
        <ImageLightbox
          src={file.url}
          alt={file.name}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
