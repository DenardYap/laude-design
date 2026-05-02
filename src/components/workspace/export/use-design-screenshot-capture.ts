"use client";

import * as React from "react";
import { match } from "ts-pattern";

import { useWorkspaceStore } from "@/stores/workspace-store";

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

interface IframeMessage {
  type?: string;
  requestId?: string;
  dataUrl?: string;
  error?: string;
}

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
  React.useEffect(() => {
    if (activeTab !== `design:${designId}`) {
      openDesignTab(projectId, designId);
    }
  }, [projectId, designId, activeTab, openDesignTab]);

  const [status, setStatus] = React.useState<CaptureStatus>({
    status: "waiting",
  });
  const [nonce, setNonce] = React.useState(0);

  // Capture a thumbnail. The in-iframe script queues the request if
  // html-to-image is still loading and replies as soon as it's ready, so a
  // single `captureWithWindow` round-trip covers both the "iframe is ready
  // now" and "iframe is still booting" cases.
  //
  // The only thing we retry client-side is "the iframe DOM isn't mounted
  // yet" — which happens when the canvas tab just switched to this design
  // and the Sandpack provider hasn't attached its iframe yet.
  React.useEffect(() => {
    setStatus({ status: "waiting" });
    let cancelled = false;
    let frameHandle: number | null = null;
    let retryHandle: number | null = null;
    const deadline = Date.now() + 15_000;

    async function attempt() {
      if (cancelled) return;
      const iframe = findCanvasIframe();
      const contentWindow = iframe?.contentWindow;
      if (!contentWindow) {
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
      try {
        const dataUrl = await captureWithWindow(contentWindow);
        if (!cancelled) setStatus({ status: "ready", dataUrl });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
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

  const captureAsync = React.useCallback(async (): Promise<string> => {
    const iframe = findCanvasIframe();
    const contentWindow = iframe?.contentWindow;
    if (!contentWindow) {
      throw new Error(
        "Canvas isn't visible — open the design on the canvas first.",
      );
    }
    return captureWithWindow(contentWindow);
  }, []);

  const recapture = React.useCallback(() => setNonce((n) => n + 1), []);

  return {
    status,
    captureAsync,
    recapture,
  } as const;
}

// Single round-trip with the in-iframe screenshot script. The script
// queues requests that arrive before `html-to-image` finishes loading and
// replies as soon as it's ready, so no retry logic is needed here.
function captureWithWindow(contentWindow: Window): Promise<string> {
  const requestId = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onResponse);
      reject(new Error("Capture timed out — try again in a second."));
    }, 15_000);

    function onResponse(ev: MessageEvent<IframeMessage>) {
      if (ev.source !== contentWindow) return;
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.requestId !== requestId) return;

      window.clearTimeout(timeout);
      window.removeEventListener("message", onResponse);

      match(data.type)
        .with("design-screenshot:result", () => {
          if (data.dataUrl) resolve(data.dataUrl);
          else reject(new Error("Capture returned no image data"));
        })
        .with("design-screenshot:error", () => {
          reject(new Error(data.error ?? "Capture failed"));
        })
        .otherwise(() => {
          reject(new Error("Unexpected response from canvas"));
        });
    }

    window.addEventListener("message", onResponse);
    contentWindow.postMessage(
      { type: "design-screenshot:request", requestId, pixelRatio: 2 },
      "*",
    );
  });
}
