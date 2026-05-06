"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DesignDTO } from "@/lib/workspace/types";
import { requestIframeScreenshot } from "@/components/workspace/canvas/utils/iframe-screenshot";
import {
  ScreenshotSandpack,
  SCREENSHOT_FRAME_HEIGHT,
  SCREENSHOT_FRAME_WIDTH,
} from "@/components/workspace/canvas/screenshot-sandpack";
import { useScreenshotRequestStore } from "@/stores/screenshot-request-store";
import type { ScreenshotHostProps } from "@/components/workspace/canvas/types/screenshot";
import {
  STICKY_KEEPALIVE_MS,
  SANDPACK_READY_TIMEOUT_MS,
  waitForSandpackReady,
  findHostedIframe,
} from "@/components/workspace/canvas/utils/screenshot-host";

/**
 * Off-screen Sandpack mount point. Listens to the screenshot request store
 */
export function ScreenshotHost({
  projectId,
  designs,
  preWarmDesignId = null,
}: ScreenshotHostProps) {
  // Local React state mirrors the *currently mounted* design id.
  const [mountedDesignId, setMountedDesignId] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const inFlightRequestId = useRef<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyDesignIds = useRef<Set<string>>(new Set());
  // Resolve functions waiting for a specific design to complete compilation.
  const pendingReadyCbs = useRef<Map<string, Set<() => void>>>(new Map());

  const designById = useMemo(() => {
    const m = new Map<string, DesignDTO>();
    for (const d of designs) m.set(d.id, d);
    return m;
  }, [designs]);

  // Stable callback passed as `onReady` to ScreenshotSandpack.
  const handleSandpackReady = useCallback((designId: string) => {
    readyDesignIds.current.add(designId);
    const cbs = pendingReadyCbs.current.get(designId);
    if (cbs) {
      for (const cb of cbs) cb();
      pendingReadyCbs.current.delete(designId);
    }
  }, []);

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
  useEffect(() => {
    if (preWarmDesignId) {
      if (inFlightRequestId.current) return;
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
  }, [preWarmDesignId, designById]);

  const resolveRequest = useScreenshotRequestStore((s) => s.resolveRequest);

  // Subscribe imperatively. We need the latest `pendingRequest` value but
  // a `useEffect` deps array on the request id is enough — the store guarantees
  // at most one pending request, so each "new request" appears exactly once.
  const pendingRequest = useScreenshotRequestStore((s) => s.pendingRequest);

  useEffect(() => {
    if (!pendingRequest || pendingRequest.projectId !== projectId) return;
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

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (mountedDesignId !== pendingRequest.designId) {
      setMountedDesignId(pendingRequest.designId);
    }

    let cancelled = false;
    const requestId = pendingRequest.id;
    const designId = pendingRequest.designId;

    void (async () => {
      try {
        if (!readyDesignIds.current.has(designId)) {
          await waitForSandpackReady(
            designId,
            pendingReadyCbs.current,
            SANDPACK_READY_TIMEOUT_MS,
          );
        }
        if (cancelled) return;

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


