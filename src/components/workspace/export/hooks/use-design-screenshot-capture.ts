"use client";

import { useCallback, useEffect, useState } from 'react';

import { useWorkspaceStore } from "@/stores/workspace-store";
import { requestIframeScreenshot } from "@/components/workspace/canvas/utils/iframe-screenshot";

// The live canvas's Sandpack iframe already has the screenshot script
// installed (see `buildSandpackFiles` → `SCREENSHOT_SCRIPT`). Rather than
// booting a second sandbox inside the export dialog — which is both slow
// and a source of layout bugs — we talk directly to the canvas iframe.
//
// The user sees the design rendering in the canvas behind the dialog
// overlay, and the export button captures what they're already looking at.
const CANVAS_IFRAME_CLASS = "sp-preview-iframe";

export type CaptureStatus =
  | { status: "waiting" }
  | { status: "ready"; dataUrl: string }
  | { status: "error"; error: string };

function findCanvasIframe(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>(
    `iframe.${CANVAS_IFRAME_CLASS}`,
  );
}

/**
 * Drives the export dialog's screenshot pipeline.
 *
 *   1. Ensures the selected design is the active tab in the canvas, so the
 *      canvas's Sandpack iframe is actually rendering that design.
 *   2. Grabs a thumbnail from that iframe for the dialog preview.
 *   3. Exposes `captureAsync()` for fresh captures on button click.
 *
 * Because the canvas iframe is already booted (Tailwind + html-to-image
 * loaded), captures are effectively instant after the first few hundred
 * milliseconds it takes React to mount the design's renderer.
 */
export function useDesignScreenshotCapture(
  projectId: string,
  designId: string,
) {
  const openDesignTab = useWorkspaceStore((s) => s.openDesignTab);
  const activeTab = useWorkspaceStore(
    (s) => s.activeTabByProject[projectId] ?? "files",
  );

  // Ensure the canvas is rendering the selected design. `openDesignTab`
  // both opens the tab (if closed) and makes it active — so it's a no-op
  // when the design is already showing.
  useEffect(() => {
    if (activeTab !== `design:${designId}`) {
      openDesignTab(projectId, designId);
    }
  }, [projectId, designId, activeTab, openDesignTab]);

  const [status, setStatus] = useState<CaptureStatus>({
    status: "waiting",
  });
  const [nonce, setNonce] = useState(0);

  // Capture a thumbnail. `requestIframeScreenshot` handles the script-not-ready
  // race by retrying on a 3-second interval and immediately resending when the
  // iframe fires `design-screenshot:ready` (e.g. after Sandpack finishes
  // recompiling on a design switch).
  //
  // The only thing we retry here is "the iframe DOM isn't mounted yet" —
  // which happens when the canvas tab just switched to this design and the
  // Sandpack provider hasn't attached its iframe yet.
  useEffect(() => {
    setStatus({ status: "waiting" });
    let cancelled = false;
    let frameHandle: number | null = null;
    let retryHandle: number | null = null;
    const deadline = Date.now() + 15_000;

    async function attempt() {
      if (cancelled) return;
      const iframe = findCanvasIframe();
      if (!iframe?.contentWindow) {
        if (Date.now() > deadline) {
          setStatus({
            status: "error",
            error:
              "Canvas isn't visible — open the design on your canvas, then retry.",
          });
          return;
        }
        retryHandle = window.setTimeout(attempt, 200);
        return;
      }
      // Use requestIframeScreenshot rather than a one-shot postMessage so that
      // requests sent while Sandpack is still compiling (e.g. right after a
      // design switch that remounts the SandpackProvider) are retried
      // automatically once the screenshot script fires `design-screenshot:ready`.
      const reply = await requestIframeScreenshot(iframe, { pixelRatio: 2 });
      if (cancelled) return;
      if (reply.error || !reply.dataUrl) {
        setStatus({ status: "error", error: reply.error ?? "Capture failed" });
      } else {
        setStatus({ status: "ready", dataUrl: reply.dataUrl });
      }
    }

    // Give the canvas a frame to (re)mount a just-switched design before
    // we look for its iframe — otherwise the first probe always misses.
    frameHandle = window.requestAnimationFrame(() => {
      retryHandle = window.setTimeout(attempt, 100);
    });

    return () => {
      cancelled = true;
      if (frameHandle !== null) window.cancelAnimationFrame(frameHandle);
      if (retryHandle !== null) window.clearTimeout(retryHandle);
    };
  }, [designId, nonce]);

  const captureAsync = useCallback(async (): Promise<string> => {
    const iframe = findCanvasIframe();
    if (!iframe?.contentWindow) {
      throw new Error(
        "Canvas isn't visible — open the design on the canvas first.",
      );
    }
    const reply = await requestIframeScreenshot(iframe, { pixelRatio: 2 });
    if (reply.error || !reply.dataUrl) {
      throw new Error(reply.error ?? "Capture failed");
    }
    return reply.dataUrl;
  }, []);

  const recapture = useCallback(() => setNonce((n) => n + 1), []);

  return {
    status,
    captureAsync,
    recapture,
  } as const;
}

