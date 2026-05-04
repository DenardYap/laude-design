"use client";

import { useCallback, useRef, useState } from "react";
import type { WheelEvent } from "react";
import {
  AlertTriangle,
  ImageIcon,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { match } from "ts-pattern";

import { Button } from "@/components/ui";
import type { ThumbnailPreviewProps } from "@/components/workspace/export/types/export";

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const MAX_NATURAL_HEIGHT = 600;

export function ThumbnailPreview({ status, designName, onRetry }: ThumbnailPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.001));
  }, []);

  const isTall = naturalHeight !== null && naturalHeight > MAX_NATURAL_HEIGHT;

  return (
    <div className="space-y-1.5">
      <div
        ref={scrollRef}
        className="relative w-full overflow-auto rounded-lg border border-border bg-surface-sunken/40"
        style={isTall ? { maxHeight: MAX_NATURAL_HEIGHT } : undefined}
        onWheel={handleWheel}
      >
        {match(status)
          .with({ status: "waiting" }, () => (
            <div
              className="flex flex-col items-center justify-center gap-2 text-ink-muted"
              style={{ minHeight: 200 }}
            >
              <Loader2 className="size-5 animate-spin" />
              <p className="text-xs font-medium">Capturing canvas…</p>
              <p className="max-w-xs text-center text-[11px] opacity-70">
                Grabbing a snapshot of the design currently rendered on your
                canvas.
              </p>
            </div>
          ))
          .with({ status: "ready" }, ({ dataUrl }) => (
            <img
              src={dataUrl}
              alt={`Preview of ${designName}`}
              draggable
              onLoad={(e) =>
                setNaturalHeight(
                  (e.currentTarget as HTMLImageElement).naturalHeight,
                )
              }
              style={{
                display: "block",
                width: `${zoom * 100}%`,
                maxWidth: "none",
                height: "auto",
                transformOrigin: "top left",
              }}
            />
          ))
          .with({ status: "error" }, ({ error }) => (
            <div
              className="flex flex-col items-center justify-center gap-3 p-6 text-center"
              style={{ minHeight: 200 }}
            >
              <AlertTriangle className="size-5 text-warning" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-ink">
                  Couldn&apos;t capture the canvas.
                </p>
                <p className="max-w-sm text-[11px] text-ink-muted">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                Try again
              </Button>
            </div>
          ))
          .exhaustive()}
      </div>

      {status.status === "ready" ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-0.5">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
              className="flex size-5 items-center justify-center rounded text-ink-muted transition-colors hover:bg-muted hover:text-ink disabled:opacity-30"
            >
              <Minus className="size-3" />
            </button>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={() => setZoom(1)}
              className="min-w-[3rem] text-center text-[11px] font-medium tabular-nums text-ink-muted hover:text-ink"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
              className="flex size-5 items-center justify-center rounded text-ink-muted transition-colors hover:bg-muted hover:text-ink disabled:opacity-30"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            <ImageIcon className="size-3" />
            Live capture
          </div>
        </div>
      ) : null}
    </div>
  );
}
