"use client";

const REQUEST_TIMEOUT_MS = 15_000;

export interface IframeScreenshotCrop {
  /** All in iframe-local CSS pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IframeScreenshotReply {
  dataUrl?: string;
  error?: string;
}

interface RequestOpts {
  pixelRatio?: number;
  crop?: IframeScreenshotCrop;
}

/**
 * Locate the Sandpack preview iframe inside `host`. Falls back to the first
 * iframe so this works for any embedded design surface that mounts an iframe.
 */
export function findSandpackIframe(
  host: HTMLElement,
): HTMLIFrameElement | null {
  return host.querySelector<HTMLIFrameElement>(
    "iframe.sp-preview-iframe, iframe",
  );
}

/**
 * Ask the Sandpack iframe to render a same-origin screenshot of the live
 * design (and optionally crop it). html-to-image cannot traverse into the
 * iframe from the parent page — it would just clone an empty <iframe/> box —
 * so we delegate to the in-iframe screenshot script that lives in
 * `sandpack-files.ts`. The script replies with a `design-screenshot:result`
 * (success) or `:error` postMessage tagged with our requestId.
 */
export function requestIframeScreenshot(
  iframe: HTMLIFrameElement,
  opts: RequestOpts = {},
): Promise<IframeScreenshotReply> {
  return new Promise((resolve) => {
    const win = iframe.contentWindow;
    if (!win) {
      resolve({ error: "Canvas iframe isn't ready yet" });
      return;
    }
    const requestId = `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;

    const onMessage = (ev: MessageEvent) => {
      if (ev.source !== win) return;
      const data = ev.data as
        | {
            type?: string;
            requestId?: string;
            dataUrl?: string;
            error?: string;
          }
        | undefined;
      if (!data || data.requestId !== requestId) return;
      if (data.type === "design-screenshot:result") {
        finish({ dataUrl: data.dataUrl });
      } else if (data.type === "design-screenshot:error") {
        finish({ error: data.error ?? "Capture failed" });
      }
    };

    const finish = (reply: IframeScreenshotReply) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      resolve(reply);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        error:
          "Canvas didn't respond. Try again in a moment — the live preview may still be compiling.",
      });
    }, REQUEST_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    win.postMessage(
      {
        type: "design-screenshot:request",
        requestId,
        pixelRatio: opts.pixelRatio ?? 2,
        crop: opts.crop,
      },
      "*",
    );
  });
}
