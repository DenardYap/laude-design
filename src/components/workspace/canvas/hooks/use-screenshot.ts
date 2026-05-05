"use client";

import { useCallback } from 'react';
import type { RefObject } from 'react';

import { toast } from "sonner";

import { uploadAttachment } from "@/lib/api/uploads";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  findSandpackIframe,
  requestIframeScreenshot,
} from "@/components/workspace/canvas/utils/iframe-screenshot";

export interface ScreenshotRect {
  /** Top-left X in viewport CSS pixels. */
  x: number;
  /** Top-left Y in viewport CSS pixels. */
  y: number;
  /** Width in viewport CSS pixels. */
  height: number;
  width: number;
}

export interface CanvasScreenshot {
  /** Capture the entire canvas immediately. */
  captureFull: () => Promise<void>;
  /** Crop the canvas to `rect` (parent-page viewport coords) and attach it. */
  captureArea: (rect: ScreenshotRect) => Promise<void>;
  /** Flip the toolbar mode so the user can drag-select directly on the canvas. */
  startAreaCapture: () => void;
}

const PIXEL_RATIO = 2;

export function useCanvasScreenshot(
  projectId: string,
  ref: RefObject<HTMLDivElement | null>,
): CanvasScreenshot {
  const sessionId = useWorkspaceStore((s) => s.activeSessionByProject[projectId]);
  const addAttachment = useWorkspaceStore((s) => s.addPendingAttachment);
  const setTool = useWorkspaceStore((s) => s.setTool);

  const attach = useCallback(
    async (dataUrl: string) => {
      if (!sessionId) {
        toast.error("Open a session first");
        return;
      }
      const file = dataUrlToFile(dataUrl, buildScreenshotName());
      const uploaded = await uploadAttachment(projectId, file);
      addAttachment(sessionId, { ...uploaded, kind: "screenshot" });
      toast.success("Screenshot attached to message");
    },
    [projectId, sessionId, addAttachment],
  );

  const captureFull = useCallback(async () => {
    if (!ref.current) return;
    if (!sessionId) {
      toast.error("Open a session first");
      return;
    }
    const iframe = findSandpackIframe(ref.current);
    if (!iframe) {
      toast.error("Canvas isn't ready yet");
      return;
    }
    try {
      const reply = await requestIframeScreenshot(iframe, {
        pixelRatio: PIXEL_RATIO,
      });
      if (reply.error || !reply.dataUrl) {
        toast.error(reply.error ?? "Couldn't capture canvas");
        return;
      }
      await attach(reply.dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Screenshot failed");
    } finally {
      setTool("idle");
    }
  }, [ref, sessionId, attach, setTool]);

  const captureArea = useCallback(
    async (rect: ScreenshotRect) => {
      if (!ref.current) {
        setTool("idle");
        return;
      }
      if (!sessionId) {
        toast.error("Open a session first");
        setTool("idle");
        return;
      }
      const iframe = findSandpackIframe(ref.current);
      if (!iframe) {
        toast.error("Canvas isn't ready yet");
        setTool("idle");
        return;
      }

      // Clamp the user's selection to the iframe's visible bounds. Anything
      // outside is canvas chrome, not actual design content.
      const iframeRect = iframe.getBoundingClientRect();
      const left = Math.max(rect.x, iframeRect.left);
      const top = Math.max(rect.y, iframeRect.top);
      const right = Math.min(rect.x + rect.width, iframeRect.right);
      const bottom = Math.min(rect.y + rect.height, iframeRect.bottom);
      const width = right - left;
      const height = bottom - top;
      if (width < 10 || height < 10) {
        toast.error("Selection is outside the design");
        setTool("idle");
        return;
      }

      // captureRef has `transform: scale(zoom)`, so iframeRect is the visual
      // rect (CSS × zoom). The screenshot script crops in iframe-local CSS
      // pixels, so divide the viewport-pixel offsets by zoom.
      const zoom = useWorkspaceStore.getState().zoom;

      try {
        const reply = await requestIframeScreenshot(iframe, {
          pixelRatio: PIXEL_RATIO,
          crop: {
            x: (left - iframeRect.left) / zoom,
            y: (top - iframeRect.top) / zoom,
            width: width / zoom,
            height: height / zoom,
          },
        });
        if (reply.error || !reply.dataUrl) {
          toast.error(reply.error ?? "Couldn't capture selection");
          return;
        }
        await attach(reply.dataUrl);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Screenshot failed");
      } finally {
        setTool("idle");
      }
    },
    [ref, sessionId, attach, setTool],
  );

  const startAreaCapture = useCallback(() => {
    if (!sessionId) {
      toast.error("Open a session first");
      return;
    }
    setTool("screenshot-area");
  }, [sessionId, setTool]);

  return { captureFull, captureArea, startAreaCapture };
}

function dataUrlToFile(dataUrl: string, name: string): File {
  // fetch(dataUrl) is blocked by CSP (connect-src doesn't allow data: URIs).
  // Decode the base64 payload directly instead.
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], name, { type: mime });
}

// Mimics macOS' "Screenshot 2026-05-01 at 3.36.42 PM.png" style — readable,
// sortable, and avoids the cryptic millisecond timestamps we used before.
function buildScreenshotName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  return `Canvas screenshot ${date} at ${time}.png`;
}
