"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ImageIcon,
  Loader2,
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
  const [copied, setCopied] = React.useState(false);
  const [pending, setPending] = React.useState<PendingAction | null>(null);

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
  // Reserve a 16:10 slot so the dialog's height doesn't lurch when the
  // thumbnail arrives.
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-surface-sunken/40"
      style={{ aspectRatio: "16 / 10" }}
    >
      {match(status)
        .with({ status: "waiting" }, () => (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted">
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
            className="block h-full w-full object-contain"
            draggable
          />
        ))
        .with({ status: "error" }, ({ error }) => (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
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
      {status.status !== "ready" ? null : (
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-ink-muted shadow-sm">
          <ImageIcon className="size-3" />
          Live capture
        </div>
      )}
    </div>
  );
}
