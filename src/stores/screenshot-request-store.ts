"use client";

import { create } from "zustand";

/**
 * Runtime-only state that brokers screenshot requests between
 * `captureDesignScreenshot` (the producer; called from the chat layer when
 * the agent invokes its `screenshotDesign` tool) and `<ScreenshotHost />`
 * (the consumer; an off-screen Sandpack instance the agent can drive
 * without disturbing the user's visible canvas).
 *
 * Lifecycle of a single request:
 *
 *   1. Producer calls `enqueueRequest({ projectId, designId })` and gets
 *      back a unique `requestId`.
 *   2. The host watches `pendingRequest`, mounts (or swaps files in) its
 *      hidden Sandpack, captures the live render, and calls
 *      `resolveRequest(requestId, { dataUrl })` (or with `{ error }` on
 *      failure).
 *   3. Producer's awaited promise (set up via `subscribeToResult`) settles
 *      with the result, then producer calls `clearRequest(requestId)` so
 *      the slot is free for the next request.
 *
 * Concurrency: at most ONE pending request at a time. A second
 * `enqueueRequest` while one is pending throws — callers can choose to
 * retry, queue, or surface the error. We don't queue internally because the
 * agent layer already serialises tool calls per turn, and a multi-tab race
 * is rare enough that "first one wins, second sees an error" is the right
 * default.
 *
 * Not persisted (no zustand `persist` middleware). State is fully resettable
 * — for tests, call `__resetForTest()` to clear all state between cases.
 */

export interface ScreenshotRequest {
  id: string;
  projectId: string;
  designId: string;
}

export type ScreenshotResult =
  | { dataUrl: string; error?: undefined }
  | { error: string; dataUrl?: undefined };

interface ScreenshotRequestState {
  pendingRequest: ScreenshotRequest | null;
  resultsById: Record<string, ScreenshotResult>;

  enqueueRequest: (args: {
    projectId: string;
    designId: string;
    /**
     * Optional id for tests / deterministic assertions. In production the
     * default `crypto.randomUUID()` is fine.
     */
    id?: string;
  }) => string;

  resolveRequest: (id: string, result: ScreenshotResult) => void;

  clearRequest: (id: string) => void;

  /** Test helper — reset every slice to an empty state. Not for production. */
  __resetForTest: () => void;
}

export class ScreenshotRequestBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreenshotRequestBusyError";
  }
}

const generateId = (): string => {
  // `crypto.randomUUID()` is widely available in modern browsers and Node
  // 19+; fall back to a low-risk Math.random id for older runtimes (still
  // unique enough for a per-tab request map).
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const useScreenshotRequestStore = create<ScreenshotRequestState>(
  (set, get) => ({
    pendingRequest: null,
    resultsById: {},

    enqueueRequest: ({ projectId, designId, id }) => {
      const existing = get().pendingRequest;
      if (existing) {
        throw new ScreenshotRequestBusyError(
          `A screenshot is already in progress for design ${existing.designId}. Wait for it to finish or cancel it before enqueueing another.`,
        );
      }
      const requestId = id ?? generateId();
      set({
        pendingRequest: { id: requestId, projectId, designId },
      });
      return requestId;
    },

    resolveRequest: (id, result) => {
      const pending = get().pendingRequest;
      // It's normal for a `resolveRequest` to arrive after `clearRequest`
      // — e.g. the producer timed out and abandoned. We still record the
      // result so a late subscriber can read it, but we don't unblock
      // pending state if the id doesn't match.
      set((s) => ({
        resultsById: { ...s.resultsById, [id]: result },
        pendingRequest: pending && pending.id === id ? null : pending,
      }));
    },

    clearRequest: (id) => {
      set((s) => {
        const { [id]: _removed, ...rest } = s.resultsById;
        const pendingMatches = s.pendingRequest?.id === id;
        return {
          resultsById: rest,
          pendingRequest: pendingMatches ? null : s.pendingRequest,
        };
      });
    },

    __resetForTest: () => set({ pendingRequest: null, resultsById: {} }),
  }),
);

/**
 * Imperative access to the store's current state — used by
 * `captureDesignScreenshot` which lives outside the React tree.
 */
export const screenshotRequestStore = {
  getState: useScreenshotRequestStore.getState,
  subscribe: useScreenshotRequestStore.subscribe,
};

/**
 * Wait for a previously-enqueued screenshot request to be resolved.
 * Returns the result, or rejects on timeout. Caller is responsible for
 * calling `clearRequest(id)` afterwards (which we do in
 * `captureDesignScreenshot`'s `finally` block).
 *
 * Implemented via `subscribe` rather than polling so the wait wakes up the
 * instant the host calls `resolveRequest` — no additional latency on top
 * of the actual capture.
 */
export function waitForScreenshotResult(
  id: string,
  timeoutMs: number,
): Promise<ScreenshotResult> {
  return new Promise((resolve, reject) => {
    // Synchronous fast path — the host may already have resolved this
    // request before our caller had a chance to await (extreme warm
    // case). No need to subscribe or set a timeout in that case.
    const initial = useScreenshotRequestStore.getState().resultsById[id];
    if (initial) {
      resolve(initial);
      return;
    }

    let settled = false;
    let unsub: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (
      kind: "resolve" | "reject",
      value: ScreenshotResult | Error,
    ) => {
      if (settled) return;
      settled = true;
      if (unsub) unsub();
      if (timeoutId !== null) clearTimeout(timeoutId);
      if (kind === "resolve") resolve(value as ScreenshotResult);
      else reject(value as Error);
    };

    unsub = useScreenshotRequestStore.subscribe((state) => {
      const r = state.resultsById[id];
      if (r) finish("resolve", r);
    });

    timeoutId = setTimeout(() => {
      finish(
        "reject",
        new Error(
          "Screenshot host didn't respond in time — the design may still be compiling.",
        ),
      );
    }, timeoutMs);
  });
}
