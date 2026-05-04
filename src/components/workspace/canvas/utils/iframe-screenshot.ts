"use client";

const REQUEST_TIMEOUT_MS = 25_000;
/** Re-send the screenshot request at this interval while waiting for a reply. */
const REQUEST_RETRY_INTERVAL_MS = 3_000;

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
  /**
   * When true, capture the FULL scroll extent of the design rather than just
   * the visible iframe viewport. Used by the agent's self-critique screenshot
   * so a long landing page is reviewed end-to-end instead of one screen at a
   * time. The iframe automatically caps the longest device-pixel edge at
   * 4096 px (provider-safe across Anthropic / OpenAI / Gemini) by dialing
   * down `pixelRatio` for very tall pages. Ignores `crop` if also set.
   */
  fullPage?: boolean;
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
 *
 * Retry logic: the screenshot request is re-sent every `REQUEST_RETRY_INTERVAL_MS`
 * and also immediately whenever the iframe's screenshot script posts
 * `design-screenshot:ready`. This handles the common case where the agent
 * just finished editing a design and Sandpack is still recompiling — the
 * first postMessage arrives before the script's `window.addEventListener`
 * is set up and is silently dropped; the retry catches it once the bundle
 * is live.
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

      // When the screenshot script becomes ready (html-to-image loaded),
      // immediately resend our request in case the first copy was dropped
      // because the script wasn't running yet.
      if (data.type === "design-screenshot:ready" && !settled) {
        sendRequest();
        return;
      }

      if (data.requestId !== requestId) return;
      if (data.type === "design-screenshot:result") {
        // Defense-in-depth: even though the iframe is sandboxed and runs
        // our own injected script, we sanity-check the payload shape so a
        // compromised or buggy in-iframe script can never trick callers
        // into uploading non-PNG content (or arbitrary strings) to our
        // attachment endpoint.
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
