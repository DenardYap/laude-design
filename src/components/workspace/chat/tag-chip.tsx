"use client";

import * as React from "react";
import { MousePointerClick, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type TagMarker } from "@/lib/workspace/tag-markers";

interface TagChipProps {
  tag: TagMarker;
  /** When provided, the chip shows a remove button (composer use). */
  onRemove?: () => void;
  className?: string;
}

const FALLBACK_LABEL = "Highlighted element";

export function TagChip({ tag, onRemove, className }: TagChipProps) {
  const preview = tag.text.trim();
  const label = preview || FALLBACK_LABEL;

  const chip = (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1 text-[11px] text-ink",
        className,
      )}
    >
      <MousePointerClick
        className="size-3 shrink-0 text-ink-muted"
        aria-hidden
      />
      <span
        className={cn(
          "max-w-[200px] truncate",
          preview ? "text-ink" : "italic text-ink-muted",
        )}
      >
        {label}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="opacity-60 hover:opacity-100"
          onClick={onRemove}
          aria-label="Remove tagged element"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );

  // Tooltip is only useful when the visible label is truncated. The CSS
  // selector itself is intentionally NOT shown — it's implementation detail
  // the user doesn't care about, even though the model still receives it.
  if (!preview) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[320px] whitespace-pre-wrap break-words text-left"
      >
        {preview}
      </TooltipContent>
    </Tooltip>
  );
}
