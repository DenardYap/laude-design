"use client";

import { useCallback, useState } from 'react';
import type { RefObject } from 'react';

import { toast } from "sonner";

import { uploadAttachment } from "@/lib/api/uploads";
import {
  selectShapes,
  useDrawingStore,
} from "@/stores/drawing-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  findSandpackIframe,
  requestIframeScreenshot,
} from "@/components/workspace/canvas/utils/iframe-screenshot";
import { dataUrlToFile } from "@/components/workspace/canvas/utils/data-url";

const PIXEL_RATIO = 2;

export interface DrawingSend {
  send: () => Promise<void>;
  /** True while the screenshot + upload is in flight. Disables the Send button. */
  sending: boolean;
}

/**
 * Capture the visible viewport (canvas + drawing layer baked in), upload it
 * as a `'sketch'` attachment, then clear the drawing and exit Draw mode.
 *
 * The Sandpack preview lives in a cross-origin iframe that the parent page
 * can't read, so a naive `toPng(viewport)` produces an empty rectangle where
 * the design should be. Instead we:
 *
 *   1. Ask the in-iframe screenshot script (see `sandpack-files.ts`) for a
 *      PNG of the design, cropped to whatever the user can currently see.
 *   2. Serialize the drawing-overlay SVG to its own PNG.
 *   3. Composite the two on a 2D canvas — design first, drawings on top —
 *      and emit a single PNG with both baked in.
 *
 * That way the agent sees both the live design AND the user's annotations.
 */
export function useDrawingSend(
  projectId: string,
  viewportRef: RefObject<HTMLDivElement | null>,
  captureRef: RefObject<HTMLDivElement | null>,
): DrawingSend {
  const sessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[projectId],
  );
  const addAttachment = useWorkspaceStore((s) => s.addPendingAttachment);
  const setTool = useWorkspaceStore((s) => s.setTool);
  const clearDrawing = useDrawingStore((s) => s.clear);
  const shapes = useDrawingStore(selectShapes(projectId));

  const [sending, setSending] = useState(false);

  const send = useCallback(async () => {
    if (sending) return;
    if (!sessionId) {
      toast.error("Open a session first");
      return;
    }
    if (shapes.length === 0) {
      toast.error("Nothing to send — draw something first");
      return;
    }
    const viewportEl = viewportRef.current;
    const captureEl = captureRef.current;
    if (!viewportEl || !captureEl) return;

    const iframe = findSandpackIframe(captureEl);
    if (!iframe) {
      toast.error("Canvas isn't ready yet");
      return;
    }

    setSending(true);
    try {
      const dataUrl = await captureSketch({
        viewportEl,
        captureEl,
        iframe,
      });
      const file = dataUrlToFile(dataUrl, buildSketchName());
      const uploaded = await uploadAttachment(projectId, file);
      addAttachment(sessionId, { ...uploaded, kind: "sketch" });
      clearDrawing(projectId);
      setTool("idle");
      toast.success("Sketch attached to message");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sketch capture failed");
    } finally {
      setSending(false);
    }
  }, [
    sending,
    sessionId,
    shapes.length,
    viewportRef,
    captureRef,
    projectId,
    addAttachment,
    clearDrawing,
    setTool,
  ]);

  return { send, sending };
}

interface CaptureArgs {
  viewportEl: HTMLDivElement;
  captureEl: HTMLDivElement;
  iframe: HTMLIFrameElement;
}

async function captureSketch({
  viewportEl,
  captureEl,
  iframe,
}: CaptureArgs): Promise<string> {
  // Find the SVG drawing layer that lives next to the iframe.
  const svg = captureEl.querySelector<SVGSVGElement>("svg");
  if (!svg) throw new Error("Drawing layer not mounted");

  // Visible region of the canvas — the user's current viewport. This is the
  // intersection of the scrollable viewport and the iframe (we don't bother
  // capturing chrome around the design). Everything here is in *viewport*
  // CSS pixels, i.e. post-transform visual coordinates.
  const viewportRect = viewportEl.getBoundingClientRect();
  const iframeRect = iframe.getBoundingClientRect();
  const visLeft = Math.max(viewportRect.left, iframeRect.left);
  const visTop = Math.max(viewportRect.top, iframeRect.top);
  const visRight = Math.min(viewportRect.right, iframeRect.right);
  const visBottom = Math.min(viewportRect.bottom, iframeRect.bottom);
  const visW = visRight - visLeft;
  const visH = visBottom - visTop;
  if (visW < 10 || visH < 10) {
    throw new Error("Nothing visible to capture");
  }

  // captureRef has `transform: scale(zoom)`, so the iframe's visual rect is
  // CSS × zoom. Divide by zoom to convert to iframe-local CSS pixels.
  const zoom = useWorkspaceStore.getState().zoom;

  // 1. Design screenshot, cropped to the visible region in iframe-local CSS pixels.
  const designReply = await requestIframeScreenshot(iframe, {
    pixelRatio: PIXEL_RATIO,
    crop: {
      x: (visLeft - iframeRect.left) / zoom,
      y: (visTop - iframeRect.top) / zoom,
      width: visW / zoom,
      height: visH / zoom,
    },
  });
  if (designReply.error || !designReply.dataUrl) {
    throw new Error(designReply.error ?? "Couldn't capture canvas");
  }

  // 2. SVG → PNG. getBoundingClientRect() returns the visual (post-transform)
  //    size = CSS × zoom. Divide by zoom for the viewBox so shape coordinates
  //    (stored in iframe CSS pixels) land in the right spot.
  const svgRect = svg.getBoundingClientRect();
  const svgImage = await rasterizeSvg(
    svg,
    svgRect.width / zoom,
    svgRect.height / zoom,
    svgRect.width,
    svgRect.height,
  );

  // Visible region in SVG-local image pixels (image is rasterized at visual
  // size, so its pixels match viewport CSS px 1:1).
  const svgVisX = visLeft - svgRect.left;
  const svgVisY = visTop - svgRect.top;

  // 3. Composite on a 2D canvas at the same pixelRatio as the design PNG so
  //    everything aligns sub-pixel-perfectly.
  const out = document.createElement("canvas");
  out.width = Math.round(visW * PIXEL_RATIO);
  out.height = Math.round(visH * PIXEL_RATIO);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const designImg = await loadImage(designReply.dataUrl);
  ctx.drawImage(designImg, 0, 0, out.width, out.height);
  ctx.drawImage(
    svgImage,
    svgVisX,
    svgVisY,
    visW,
    visH,
    0,
    0,
    out.width,
    out.height,
  );

  return out.toDataURL("image/png");
}

/**
 * Render an `<svg>` element to a same-origin PNG via XMLSerializer + Image.
 * The viewBox dimensions describe the SVG's userspace (iframe-CSS pixels in
 * our case), while `rasterW/rasterH` control the pixel resolution of the
 * resulting bitmap — picking those independently lets the live canvas zoom
 * up without producing a blurry sketch.
 */
async function rasterizeSvg(
  svg: SVGSVGElement,
  viewBoxW: number,
  viewBoxH: number,
  rasterW: number,
  rasterH: number,
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.max(1, Math.round(rasterW))));
  clone.setAttribute("height", String(Math.max(1, Math.round(rasterH))));
  clone.setAttribute("viewBox", `0 0 ${viewBoxW} ${viewBoxH}`);
  const xml = new XMLSerializer().serializeToString(clone);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  return loadImage(dataUrl);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function buildSketchName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  return `Canvas sketch ${date} at ${time}.png`;
}
