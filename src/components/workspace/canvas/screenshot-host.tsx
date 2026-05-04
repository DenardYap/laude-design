"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { DesignDTO } from "@/lib/workspace/types";
import {
  findSandpackIframe,
  requestIframeScreenshot,
} from "@/components/workspace/canvas/utils/iframe-screenshot";
import {
  ScreenshotSandpack,
  SCREENSHOT_FRAME_HEIGHT,
  SCREENSHOT_FRAME_WIDTH,
} from "@/components/workspace/canvas/screenshot-sandpack";
import { useScreenshotRequestStore } from "@/stores/screenshot-request-store";
import type { ScreenshotHostProps } from "@/components/workspace/canvas/types/screenshot";

/**
 * How long the hidden Sandpack stays mounted after the most recent
 * screenshot before we tear it down. Keeps cold-start cost out of the
 * critical path of multi-round revision sessions: the first capture
 * incurs a 3–7s Sandpack boot, every subsequent capture in the next 60s
 * (typical revision cadence) finishes in ~1s.
 *
 * Two side-effects make this a real tradeoff worth tuning rather than
 * a free win:
 *   - The hidden iframe holds an active CodeSandbox bundler in memory
 *     (~50–100 MB).
 *   - It runs an additional Tailwind / React render that could surface
 *     errors in the console even when the user isn't on this design.
 *
 * 60s is the default; tweak by feel if usage data suggests a different
 * sweet spot. NOT exposed as a prop — keep it consistent across the app.
 */
const STICKY_KEEPALIVE_MS = 60_000;

const IFRAME_WAIT_TIMEOUT_MS = 8_000;
const IFRAME_POLL_INTERVAL_MS = 150;

/**
 * Off-screen Sandpack mount point. Listens to the screenshot request store
 * and, whenever the producer (`captureDesignScreenshot`) enqueues a
 * request, swaps the hidden Sandpack to the requested design, waits for
 * its iframe to be hot, captures a full-page PNG, and resolves the
 * request — all without ever touching the visible canvas.
 *
 * Sticky-mount: after each successful capture we keep the Sandpack alive
 * for `STICKY_KEEPALIVE_MS` so a multi-round revision sequence on the
 * same design reuses the warm bundler instead of paying cold-start
 * overhead per round.
 *
 * Concurrency: the store enforces "at most one pending request" — a
 * second `enqueueRequest` call while one is in flight throws synchronously
 * inside `captureDesignScreenshot`. The host therefore never has to
 * reason about overlapping captures.
 *
 * Off-screen positioning: `position: fixed; left/top: -9999px` instead of
 * `display: none` because Sandpack relies on layout being computed for
 * `<iframe>` measurements. `pointer-events: none` and `aria-hidden` keep
 * it out of accessibility / hit-testing trees so the user can never
 * interact with it by accident.
 */
export function ScreenshotHost({ projectId, designs }: ScreenshotHostProps) {
  // Local React state mirrors the *currently mounted* design id. Lags the
  // pending request when we're swapping designs — that gap is what the
  // ready-poll below is for.
  const [mountedDesignId, setMountedDesignId] = useState<string | null>(
    null,
  );
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Tracks whether the in-flight request is currently being processed by
  // this host. Prevents the request-watch effect from re-firing capture
  // for the same id if the store snapshot resubscribes.
  const inFlightRequestId = useRef<string | null>(null);

  // Sticky teardown timer. Stored in a ref so we can cancel it the moment
  // a fresh request arrives.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const designById = useMemo(() => {
    const m = new Map<string, DesignDTO>();
    for (const d of designs) m.set(d.id, d);
    return m;
  }, [designs]);

  const resolveRequest = useScreenshotRequestStore(
    (s) => s.resolveRequest,
  );

  // Subscribe imperatively. We need the latest `pendingRequest` value but
  // a `useEffect` deps array on the request id is enough — the store guarantees
  // at most one pending request, so each "new request" appears exactly once.
  const pendingRequest = useScreenshotRequestStore(
    (s) => s.pendingRequest,
  );

  useEffect(() => {
    // Ignore cross-project requests — the host is mounted per-project, so a
    // request for a different project shouldn't trigger this instance.
    if (!pendingRequest || pendingRequest.projectId !== projectId) return;

    // Idempotency guard — if React re-runs this effect for the same id
    // (e.g. designs prop change between effect runs), don't re-fire.
    if (inFlightRequestId.current === pendingRequest.id) return;

    const design = designById.get(pendingRequest.designId);
    if (!design) {
      resolveRequest(pendingRequest.id, {
        error:
          "Design not found in this project — it may have been deleted while the screenshot was queued.",
      });
      return;
    }

    inFlightRequestId.current = pendingRequest.id;

    // Cancel any pending teardown — we're active again.
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    // Mount (or swap) the requested design. If `mountedDesignId` is
    // already the right one, this is a no-op for React state.
    if (mountedDesignId !== pendingRequest.designId) {
      setMountedDesignId(pendingRequest.designId);
    }

    let cancelled = false;
    const requestId = pendingRequest.id;

    void (async () => {
      try {
        // Wait for the iframe to actually exist + have a contentWindow we
        // can postMessage to. Sandpack mounts asynchronously and the
        // bundler can take a few hundred ms to a few seconds depending on
        // cold/warm state.
        const iframe = await waitForHostedIframe(
          hostRef,
          pendingRequest.designId,
          IFRAME_WAIT_TIMEOUT_MS,
        );
        if (cancelled) return;

        const reply = await requestIframeScreenshot(iframe, {
          pixelRatio: 2,
          fullPage: true,
        });
        if (cancelled) return;

        if (reply.error || !reply.dataUrl) {
          resolveRequest(requestId, {
            error: reply.error ?? "Hidden canvas didn't return a screenshot.",
          });
        } else {
          resolveRequest(requestId, { dataUrl: reply.dataUrl });
        }
      } catch (err) {
        if (cancelled) return;
        resolveRequest(requestId, {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        // Schedule sticky teardown regardless of outcome — we don't keep
        // a broken bundler alive any longer than a healthy one.
        if (!cancelled) {
          inFlightRequestId.current = null;
          scheduleTeardown();
        }
      }
    })();

    return () => {
      cancelled = true;
    };

    function scheduleTeardown() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        idleTimerRef.current = null;
        // Only tear down if no new request snuck in during the wait.
        const stillIdle =
          useScreenshotRequestStore.getState().pendingRequest === null;
        if (stillIdle) {
          setMountedDesignId(null);
        }
      }, STICKY_KEEPALIVE_MS);
    }
    // We depend ONLY on the request id (so each new request fires the
    // effect exactly once) and on `designs` via `designById` (so a
    // freshly-created design becomes screenshot-able as soon as it
    // arrives in props). `mountedDesignId` and `resolveRequest` are
    // intentionally omitted — they're refs/stable callbacks captured
    // through closures, and including them would re-run the effect
    // mid-capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest?.id, designById]);

  // Cleanup on unmount — cancel any pending teardown timer so it doesn't
  // fire after the host is gone (no-op for state, but keeps the timer
  // count accurate for tests / dev mode).
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  if (mountedDesignId === null) return null;

  const design = designById.get(mountedDesignId);
  if (!design) return null;

  return (
    <div
      // Keep it in the layout tree (so iframes have measurable bounds),
      // but well off-screen and inert. `aria-hidden` excludes it from the
      // accessibility tree; `pointer-events: none` makes it impossible to
      // accidentally focus.
      aria-hidden
      style={{
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        width: `${SCREENSHOT_FRAME_WIDTH}px`,
        height: `${SCREENSHOT_FRAME_HEIGHT}px`,
        pointerEvents: "none",
      }}
    >
      <ScreenshotSandpack design={design} hostRef={hostRef} />
    </div>
  );
}

/**
 * Poll the host's DOM until the Sandpack iframe is mounted, has a
 * `contentWindow` (i.e. is actually a navigable document, not just a
 * placeholder element), and stamps `data-design-id` matching the request.
 * Throws on timeout so the orchestrator surfaces a clean error to the
 * agent rather than hanging.
 */
async function waitForHostedIframe(
  hostRef: RefObject<HTMLDivElement | null>,
  designId: string,
  timeoutMs: number,
): Promise<HTMLIFrameElement> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const host = hostRef.current;
    if (host && host.dataset.designId === designId) {
      const iframe =
        host.querySelector<HTMLIFrameElement>("iframe.sp-preview-iframe") ??
        findSandpackIframe(host);
      if (iframe?.contentWindow) return iframe;
    }
    await sleep(IFRAME_POLL_INTERVAL_MS);
  }
  throw new Error(
    "Hidden screenshot iframe didn't mount in time — the design may still be compiling.",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
