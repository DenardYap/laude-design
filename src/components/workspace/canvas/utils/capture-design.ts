"use client";

import { uploadAttachment, type UploadedFile } from "@/lib/api/uploads";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  screenshotRequestStore,
  useScreenshotRequestStore,
  waitForScreenshotResult,
} from "@/stores/screenshot-request-store";
import {
  findSandpackIframe,
  requestIframeScreenshot,
} from "@/components/workspace/canvas/utils/iframe-screenshot";
import {
  buildScreenshotFilename,
  cssAttrEscape,
  isValidPngDataUrl,
  isVisibleCanvasOnDesign,
} from "@/components/workspace/canvas/utils/capture-design-helpers";

export interface CaptureDesignOptions {
  projectId: string;
  designId: string;
}

const PIXEL_RATIO = 2;
const VISIBLE_MOUNT_TIMEOUT_MS = 3_000;
// 3s for the visible-iframe fast path (the iframe is already hot — if it
// didn't appear in 3s, something else is wrong and we should fall back to
// the hidden host rather than wait further).
const HIDDEN_HOST_TIMEOUT_MS = 60_000;
// 60s budget for the hidden host. The host now waits for Sandpack's "done"
// event (up to 35s) before calling requestIframeScreenshot (25s), giving a
// worst-case ceiling of ~60s for very slow first-run compiles. Warm repeat
// captures complete in ~1-3s because `readyDesignIds` skips the wait.

/**
 * Capture the live render of a design and upload it. Used by the agent's
 * `screenshotDesign` tool. Picks the cheapest path that produces the
 * correct pixels:
 *
 *   1. **Visible iframe fast path** — when the user is currently viewing
 *      the requested design, capture from the canvas's live Sandpack
 *      iframe. ~0 overhead beyond the htmlToImage render itself.
 *
 *   2. **Hidden host fallback** — otherwise, enqueue a request to the
 *      `<ScreenshotHost/>` instance mounted in `ProjectWorkspace`. That
 *      component owns an off-screen Sandpack it spins up on demand,
 *      keeps alive for `STICKY_KEEPALIVE_MS` (revision rounds reuse the
 *      warm bundle), and drives postMessage screenshot requests against.
 *      Cold-start overhead: ~3-7s on first request, ~1s for warm
 *      subsequent requests within the keepalive window.
 *
 * Throws on every failure path so the caller can surface a tool error to
 * the model instead of silently resolving with garbage.
 */
export async function captureDesignScreenshot(
  opts: CaptureDesignOptions,
): Promise<UploadedFile> {
  const { projectId, designId } = opts;

  const dataUrl = await captureDataUrl(projectId, designId);

  if (!isValidPngDataUrl(dataUrl)) {
    // Both paths already validate this internally, but a third check at
    // the orchestrator boundary is the cheapest belt-and-braces we can
    // add — never upload garbage to `/uploads/` no matter how it got
    // here.
    throw new Error(
      "Canvas returned an unexpected payload — refusing to upload. Try again in a moment.",
    );
  }

  const file = dataUrlToFile(dataUrl, buildScreenshotFilename());
  return uploadAttachment(projectId, file);
}

async function captureDataUrl(
  projectId: string,
  designId: string,
): Promise<string> {
  const activeTab = useWorkspaceStore.getState().activeTabByProject[projectId];
  if (isVisibleCanvasOnDesign(activeTab, designId)) {
    const iframe = await findVisibleIframe(designId, VISIBLE_MOUNT_TIMEOUT_MS);
    if (iframe) {
      const reply = await requestIframeScreenshot(iframe, {
        pixelRatio: PIXEL_RATIO,
        fullPage: true,
      });
      if (!reply.error && reply.dataUrl) return reply.dataUrl;
      // Fall through to the hidden path on failure — the visible iframe
      // might be in the middle of a hot reload, in which case the hidden
      // host's fresh mount has a better chance of succeeding.
    }
  }

  return captureViaHiddenHost(projectId, designId);
}

/**
 * Look up the visible Sandpack iframe inside the `data-design-id`-stamped
 * canvas root. Returns `null` (rather than throwing) if it isn't there
 * yet — the orchestrator falls back to the hidden host in that case
 * rather than blocking on a slow visible mount.
 */
async function findVisibleIframe(
  designId: string,
  timeoutMs: number,
): Promise<HTMLIFrameElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const host = document.querySelector<HTMLElement>(
      `[data-canvas-root][data-design-id="${cssAttrEscape(designId)}"]`,
    );
    const iframe = host
      ? (host.querySelector<HTMLIFrameElement>("iframe.sp-preview-iframe") ??
        findSandpackIframe(host))
      : null;
    if (iframe?.contentWindow) return iframe;
    await sleep(150);
  }
  return null;
}

/**
 * Enqueue a screenshot request for the off-screen `<ScreenshotHost/>`
 * to fulfil. Awaits the result, then unblocks the slot for the next
 * request.
 */
async function captureViaHiddenHost(
  projectId: string,
  designId: string,
): Promise<string> {
  const requestId = useScreenshotRequestStore.getState().enqueueRequest({
    projectId,
    designId,
  });

  try {
    const result = await waitForScreenshotResult(
      requestId,
      HIDDEN_HOST_TIMEOUT_MS,
    );
    if (result.error || !result.dataUrl) {
      throw new Error(
        result.error ??
          "Hidden screenshot host returned an empty result — the design may still be compiling.",
      );
    }
    return result.dataUrl;
  } finally {
    // Always free the slot. Even if `waitForScreenshotResult` rejected on
    // timeout, the host will eventually call `resolveRequest` for this id
    // — `clearRequest` strips both pending state (if it matches) and any
    // late-arriving result, so we don't leak.
    screenshotRequestStore.getState().clearRequest(requestId);
  }
}

function dataUrlToFile(dataUrl: string, name: string): File {
  // fetch(dataUrl) is blocked by CSP (connect-src doesn't cover data: URIs).
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
