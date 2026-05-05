"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

/**
 * How long to wait for Sandpack's bundler to fire its "done" event before
 * attempting the screenshot anyway (best-effort fallback). This replaces the
 * old `IFRAME_WAIT_TIMEOUT_MS` poll which only waited for an iframe DOM
 * element — not for the compiled bundle to be live.
 *
 * Cold-start Sandpack compilation (npm resolution + bundling) typically takes
 * 3–10 s; 35 s is a conservative ceiling that covers slow machines and
 * network-cached-but-slow CDN hits. If compilation genuinely takes longer we
 * still fall through and let `requestIframeScreenshot`'s retry loop handle it.
 */
const SANDPACK_READY_TIMEOUT_MS = 35_000;

/**
 * Off-screen Sandpack mount point. Listens to the screenshot request store
 * and, whenever the producer (`captureDesignScreenshot`) enqueues a
 * request, swaps the hidden Sandpack to the requested design, waits for
 * Sandpack to signal compilation is done ("done" event via `ReadinessMonitor`),
 * then captures a full-page PNG and resolves the request — all without ever
 * touching the visible canvas.
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
export function ScreenshotHost({
  projectId,
  designs,
  preWarmDesignId = null,
}: ScreenshotHostProps) {
  // Local React state mirrors the *currently mounted* design id. Lags the
  // pending request when we're swapping designs — that gap is handled by
  // waiting for Sandpack's "done" event rather than polling the DOM.
  const [mountedDesignId, setMountedDesignId] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Tracks whether the in-flight request is currently being processed by
  // this host. Prevents the request-watch effect from re-firing capture
  // for the same id if the store snapshot resubscribes.
  const inFlightRequestId = useRef<string | null>(null);

  // Sticky teardown timer. Stored in a ref so we can cancel it the moment
  // a fresh request arrives.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks which mounted design IDs have already fired Sandpack's "done"
  // event (i.e. compilation is complete and the preview is live). Cleared
  // when the mounted design is swapped so a fresh mount always waits for
  // its own compilation to finish before attempting a screenshot.
  const readyDesignIds = useRef<Set<string>>(new Set());

  // Resolve functions waiting for a specific design to complete compilation.
  // Keyed by design ID; flushed when `handleSandpackReady` fires.
  const pendingReadyCbs = useRef<Map<string, Set<() => void>>>(new Map());

  const designById = useMemo(() => {
    const m = new Map<string, DesignDTO>();
    for (const d of designs) m.set(d.id, d);
    return m;
  }, [designs]);

  // Stable callback passed as `onReady` to ScreenshotSandpack. The
  // ReadinessMonitor inside ScreenshotSandpack calls this when Sandpack's
  // bundler fires `message.type === "done"`.
  const handleSandpackReady = useCallback((designId: string) => {
    readyDesignIds.current.add(designId);
    const cbs = pendingReadyCbs.current.get(designId);
    if (cbs) {
      for (const cb of cbs) cb();
      pendingReadyCbs.current.delete(designId);
    }
  }, []);

  // When the mounted design is swapped, invalidate the previous design's
  // readiness so a future remount of the same ID waits for fresh compilation.
  const prevMountedDesignIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      prevMountedDesignIdRef.current &&
      prevMountedDesignIdRef.current !== mountedDesignId
    ) {
      readyDesignIds.current.delete(prevMountedDesignIdRef.current);
    }
    prevMountedDesignIdRef.current = mountedDesignId;
  }, [mountedDesignId]);

  // Pre-warm / eager-teardown driven by the self-critique flag in the caller.
  //
  // When `preWarmDesignId` is non-null (self-critique is ON):
  //   mount the hidden Sandpack for that design immediately so cold-start
  //   compilation happens in the background while the agent is editing —
  //   by the time `screenshotDesign` is called, the bundler is already warm
  //   and `readyDesignIds` has been populated.
  //
  // When it becomes null again (self-critique turned OFF):
  //   skip the sticky keepalive timer and unmount right away, unless a
  //   capture is currently in flight (in which case we leave it alone and
  //   let the normal scheduleTeardown path handle cleanup).
  useEffect(() => {
    if (preWarmDesignId) {
      // Don't overwrite a different design that's actively being captured.
      if (inFlightRequestId.current) return;
      // Cancel any pending teardown and keep it alive.
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (!designById.has(preWarmDesignId)) return;
      setMountedDesignId(preWarmDesignId);
    } else {
      // Self-critique turned off — tear down immediately when idle.
      if (inFlightRequestId.current) return;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      setMountedDesignId(null);
    }
  // `designById` covers design availability; `preWarmDesignId` is the only
  // trigger we need — intentionally omit `mountedDesignId` to avoid
  // fighting with the pending-request effect over what's mounted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preWarmDesignId, designById]);

  const resolveRequest = useScreenshotRequestStore((s) => s.resolveRequest);

  // Subscribe imperatively. We need the latest `pendingRequest` value but
  // a `useEffect` deps array on the request id is enough — the store guarantees
  // at most one pending request, so each "new request" appears exactly once.
  const pendingRequest = useScreenshotRequestStore((s) => s.pendingRequest);

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
    const designId = pendingRequest.designId;

    void (async () => {
      try {
        // If Sandpack has already compiled for this design (pre-warmed or a
        // warm repeat capture), skip straight to the screenshot. Otherwise
        // wait for the ReadinessMonitor inside ScreenshotSandpack to signal
        // "done". This prevents the previous race where requestIframeScreenshot
        // started its 25s countdown before the bundler had even finished.
        if (!readyDesignIds.current.has(designId)) {
          await waitForSandpackReady(
            designId,
            pendingReadyCbs.current,
            SANDPACK_READY_TIMEOUT_MS,
          );
        }
        if (cancelled) return;

        // Compilation is done (or we hit the fallback timeout). The iframe
        // should now exist and have the screenshot script installed.
        const iframe = findHostedIframe(hostRef, designId);
        if (!iframe) {
          resolveRequest(requestId, {
            error:
              "Hidden screenshot iframe not found after Sandpack compiled — the design may have an error.",
          });
          return;
        }

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
    // Depend ONLY on the request id (so each new request fires the effect
    // exactly once) and on `designs` via `designById`. `mountedDesignId`
    // and `resolveRequest` are intentionally omitted — they're stable/ref
    // values captured through closures so including them would re-run the
    // effect mid-capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest?.id, designById]);

  // Cleanup on unmount — cancel any pending teardown timer.
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
      <ScreenshotSandpack
        design={design}
        hostRef={hostRef}
        onReady={() => handleSandpackReady(design.id)}
      />
    </div>
  );
}

/**
 * Wait for Sandpack to signal compilation is complete for `designId`. Resolves
 * as soon as `handleSandpackReady(designId)` is called from `ReadinessMonitor`,
 * or after `timeoutMs` as a fallback (so we still attempt the screenshot on
 * very slow machines rather than hanging forever).
 */
function waitForSandpackReady(
  designId: string,
  pendingCbs: Map<string, Set<() => void>>,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // Timed out — clean up and fall through to best-effort screenshot.
      const cbs = pendingCbs.get(designId);
      if (cbs) {
        cbs.delete(wrappedResolve);
        if (cbs.size === 0) pendingCbs.delete(designId);
      }
      resolve();
    }, timeoutMs);

    function wrappedResolve() {
      clearTimeout(timer);
      resolve();
    }

    let cbs = pendingCbs.get(designId);
    if (!cbs) {
      cbs = new Set();
      pendingCbs.set(designId, cbs);
    }
    cbs.add(wrappedResolve);
  });
}

/**
 * Synchronous iframe lookup. By the time this is called Sandpack has already
 * fired "done", so the iframe element is guaranteed to be in the DOM.
 */
function findHostedIframe(
  hostRef: React.RefObject<HTMLDivElement | null>,
  designId: string,
): HTMLIFrameElement | null {
  const host = hostRef.current;
  if (!host || host.dataset.designId !== designId) return null;
  return (
    host.querySelector<HTMLIFrameElement>("iframe.sp-preview-iframe") ??
    findSandpackIframe(host) ??
    null
  );
}
