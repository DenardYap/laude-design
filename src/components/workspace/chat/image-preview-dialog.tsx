"use client";

import { useCallback, useEffect, useState } from "react";
import type { WheelEvent } from "react";

import { Minus, Plus, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui";
import type {
  ImageViewportProps,
  ZoomToolbarProps,
} from "@/components/workspace/chat/types/image-preview";

const IMG_ZOOM_STEP = 0.25;
const IMG_ZOOM_MIN = 0.25;
const IMG_ZOOM_MAX = 4;
// Natural image heights taller than this trigger vertical scrolling.
const IMG_MAX_HEIGHT = 800;

const clamp = (z: number) => Math.min(IMG_ZOOM_MAX, Math.max(IMG_ZOOM_MIN, z));

// ---------------------------------------------------------------------------
// ImageViewport — scrollable container + the actual <img>
// ---------------------------------------------------------------------------

function ImageViewport({
  url,
  name,
  zoom,
  naturalHeight,
  onNaturalHeightLoad,
  onWheel,
}: ImageViewportProps) {
  const isTall = naturalHeight !== null && naturalHeight > IMG_MAX_HEIGHT;
  return (
    <div
      className="overflow-auto"
      style={isTall ? { maxHeight: IMG_MAX_HEIGHT } : undefined}
      onWheel={onWheel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name}
        onLoad={(e) =>
          onNaturalHeightLoad(
            (e.currentTarget as HTMLImageElement).naturalHeight,
          )
        }
        style={{
          display: "block",
          width: `${zoom * 100}%`,
          maxWidth: "none",
          height: "auto",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZoomToolbar — zoom controls + close button
// ---------------------------------------------------------------------------

function ZoomToolbar({ zoom, onZoomChange }: ZoomToolbarProps) {
  return (
    <div className="flex items-center justify-between border-t border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-0.5">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= IMG_ZOOM_MIN}
          onClick={() => onZoomChange(clamp(zoom - IMG_ZOOM_STEP))}
          className="flex size-5 items-center justify-center rounded text-ink-muted transition-colors hover:bg-muted hover:text-ink disabled:opacity-30"
        >
          <Minus className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={() => onZoomChange(1)}
          className="min-w-[3rem] text-center text-[11px] font-medium tabular-nums text-ink-muted hover:text-ink"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= IMG_ZOOM_MAX}
          onClick={() => onZoomChange(clamp(zoom + IMG_ZOOM_STEP))}
          className="flex size-5 items-center justify-center rounded text-ink-muted transition-colors hover:bg-muted hover:text-ink disabled:opacity-30"
        >
          <Plus className="size-3" />
        </button>
      </div>
      <DialogClose
        aria-label="Close preview"
        className="inline-flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" />
      </DialogClose>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImagePreviewDialog — public API
// ---------------------------------------------------------------------------

export function ImagePreviewDialog({
  open,
  onOpenChange,
  url,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  name: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setNaturalHeight(null);
    }
  }, [open]);

  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZoom((z) => clamp(z - e.deltaY * 0.001));
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showDefaultClose={false}
        className="w-[90vw] max-w-[90vw] sm:max-w-[90vw] gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <ImageViewport
          url={url}
          name={name}
          zoom={zoom}
          naturalHeight={naturalHeight}
          onNaturalHeightLoad={setNaturalHeight}
          onWheel={handleWheel}
        />
        <ZoomToolbar zoom={zoom} onZoomChange={setZoom} />
      </DialogContent>
    </Dialog>
  );
}
