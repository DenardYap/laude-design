import type React from "react";

import { findSandpackIframe } from "@/components/workspace/canvas/utils/iframe-screenshot";

export const STICKY_KEEPALIVE_MS = 60_000;
export const SANDPACK_READY_TIMEOUT_MS = 35_000;

export function waitForSandpackReady(
  designId: string,
  pendingCbs: Map<string, Set<() => void>>,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
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

export function findHostedIframe(
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
