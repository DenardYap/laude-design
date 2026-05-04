"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import {
  copyImageToClipboard,
  downloadPdfFromDataUrl,
  downloadPngFromDataUrl,
} from "@/components/workspace/export/utils/image-export-actions";
import { ThumbnailPreview } from "@/components/workspace/export/thumbnail-preview";
import type { ImageExportTabProps, PendingAction } from "@/components/workspace/export/types/export";

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
