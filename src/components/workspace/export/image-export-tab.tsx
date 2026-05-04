"use client";

import { useCallback, useRef, useState } from 'react';
import type { WheelEvent } from 'react';

import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ImageIcon,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { match } from "ts-pattern";
import { toast } from "sonner";

import type { DesignDTO } from "@/lib/workspace/types";
import { Button } from "@/components/ui";
import {
  copyImageToClipboard,
  downloadPdfFromDataUrl,
  downloadPngFromDataUrl,
} from "@/components/workspace/export/image-export-actions";
import type { CaptureStatus } from "@/components/workspace/export/use-design-screenshot-capture";

type PendingAction = "copy" | "png" | "pdf";

interface ImageExportTabProps {
  design: DesignDTO;
  status: CaptureStatus;
  onRetry: () => void;
  captureAsync: () => Promise<string>;
}

export function ImageExportTab({
  design,
  status,
  onRetry,
  captureAsync,
}: ImageExportTabProps) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const canAct = status.status === "ready" && pending === null;

  async function withCapture<T>(
    action: PendingAction,
    fn: (dataUrl: string) => Promise<T>,
  ) {
    try {
      setPending(action);
      // Prefer the cached thumbnail when we have one — it was captured from
      // exactly the same iframe the user is looking at. Falling through to
      // `captureAsync` would just re-run the same postMessage round-trip.
      const dataUrl =
        status.status === "ready" ? status.dataUrl : await captureAsync();
      await fn(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(null);
    }
  }

  async function handleCopy() {
    await withCapture("copy", async (dataUrl) => {
      await copyImageToClipboard(dataUrl);
      setCopied(true);
      toast.success("Image copied — paste it into your agent");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDownloadPng() {
    await withCapture("png", (dataUrl) =>
      downloadPngFromDataUrl(dataUrl, design.name),
    );
  }

  async function handleDownloadPdf() {
    await withCapture("pdf", (dataUrl) =>
      downloadPdfFromDataUrl(dataUrl, design.name),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-muted">
          Captures the design currently showing on your canvas. Click Copy image
          to drop a screenshot into coding agents like Cursor.
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={!canAct}
            className="gap-1 text-xs"
          >
            {pending === "pdf" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            .pdf
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPng}
            disabled={!canAct}
            className="gap-1 text-xs"
          >
            {pending === "png" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            .png
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCopy}
            disabled={!canAct}
            className="gap-1"
          >
            {pending === "copy" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {pending === "copy"
              ? "Capturing…"
              : copied
                ? "Copied"
                : "Copy image"}
          </Button>
        </div>
      </div>

      <ThumbnailPreview
        status={status}
        onRetry={onRetry}
        designName={design.name}
      />
    </div>
  );
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
// Images taller than this (in px) scroll instead of expanding the dialog.
const MAX_NATURAL_HEIGHT = 600;

interface ThumbnailPreviewProps {
  status: CaptureStatus;
  designName: string;
  onRetry: () => void;
}

function ThumbnailPreview({
  status,
  designName,
  onRetry,
}: ThumbnailPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  // Mouse-wheel zoom (no page scroll side-effect while pointer is over preview).
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.001));
  }, []);

  const isTall = naturalHeight !== null && naturalHeight > MAX_NATURAL_HEIGHT;

  return (
    <div className="space-y-1.5">
      {/* Scrollable viewport — height is unconstrained for short images; capped
          for very tall ones so the dialog doesn't grow off-screen. */}
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

      {/* Zoom controls — only shown once the image is ready */}
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
