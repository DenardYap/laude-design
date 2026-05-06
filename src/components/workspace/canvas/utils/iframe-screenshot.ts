"use client";

import type {
  IframeScreenshotCrop,
  IframeScreenshotReply,
  IframeScreenshotRequestOpts,
} from "@/components/workspace/canvas/types/iframe-screenshot";

export type {
  IframeScreenshotCrop,
  IframeScreenshotReply,
  IframeScreenshotRequestOpts,
};

const REQUEST_TIMEOUT_MS = 25_000;
const REQUEST_RETRY_INTERVAL_MS = 3_000;

/**
 * Locate the Sandpack preview iframe inside `host`.
 */
export function findSandpackIframe(
  host: HTMLElement,
): HTMLIFrameElement | null {
  return host.querySelector<HTMLIFrameElement>(
    "iframe.sp-preview-iframe, iframe",
  );
}

/**
 * Ask the Sandpack iframe to render a same-origin screenshot of the live design.
 */
export function requestIframeScreenshot(
  iframe: HTMLIFrameElement,
  opts: IframeScreenshotRequestOpts = {},
): Promise<IframeScreenshotReply> {
  return new Promise((resolve) => {
    const win = iframe.contentWindow;
    if (!win) {
      resolve({ error: "Canvas iframe isn't ready yet" });
      return;
    }
    const requestId = `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;

    const sendRequest = () => {
      if (settled) return;
      win.postMessage(
        {
          type: "design-screenshot:request",
          requestId,
          pixelRatio: opts.pixelRatio ?? 2,
          crop: opts.crop,
          fullPage: opts.fullPage === true,
        },
        "*",
      );
    };

    const onMessage = (ev: MessageEvent) => {
      // Only accept messages from the iframe we're talking to. Other frames
      // (or `window.opener` shenanigans) cannot impersonate this reply.
      if (ev.source !== win) return;
      const data = ev.data as
        | {
            type?: string;
            requestId?: string;
            dataUrl?: string;
            error?: string;
          }
        | undefined;
      if (!data) return;

      if (data.type === "design-screenshot:ready" && !settled) {
        sendRequest();
        return;
      }

      if (data.requestId !== requestId) return;
      if (data.type === "design-screenshot:result") {
        if (!isLikelyPngDataUrl(data.dataUrl)) {
          finish({
            error:
              "Canvas returned an unexpected payload (not a PNG). Refusing to use it.",
          });
          return;
        }
        finish({ dataUrl: data.dataUrl });
      } else if (data.type === "design-screenshot:error") {
        finish({
          error:
            typeof data.error === "string"
              ? data.error.slice(0, 500)
              : "Capture failed",
        });
      }
    };

    const finish = (reply: IframeScreenshotReply) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      window.clearInterval(retryIntervalId);
      resolve(reply);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        error:
          "Canvas didn't respond. Try again in a moment — the live preview may still be compiling.",
      });
    }, REQUEST_TIMEOUT_MS);

    window.addEventListener("message", onMessage);

    // Send the first request and ask whether the script is already ready
    // (handles the case where html-to-image loaded before we attached the
    // listener and the :ready broadcast was already missed).
    sendRequest();
    win.postMessage({ type: "design-screenshot:are-you-ready" }, "*");

    // Periodically resend so a late-compiled bundle still gets a chance
    // to respond without waiting for the full timeout.
    const retryIntervalId = window.setInterval(sendRequest, REQUEST_RETRY_INTERVAL_MS);
  });
}

function isLikelyPngDataUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const PREFIX = "data:image/png;base64,";
  if (!s.startsWith(PREFIX)) return false;
  // Match the cap in `capture-design.ts` so we fail fast at this layer too
  // rather than letting an oversize blob travel further.
  if (s.length > 24 * 1024 * 1024) return false;
  const body = s.slice(PREFIX.length);
  if (body.length === 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(body);
}
