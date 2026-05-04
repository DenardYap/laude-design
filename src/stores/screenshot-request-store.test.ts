import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ScreenshotRequestBusyError,
  useScreenshotRequestStore,
  waitForScreenshotResult,
} from "./screenshot-request-store";

/**
 * The screenshot request store is the contract between
 * `captureDesignScreenshot` (producer) and `<ScreenshotHost/>` (consumer).
 * Bugs here surface as either:
 *   - Stuck pending state — the host can't process new requests because
 *     a stale id is wedged in.
 *   - Races where two requests are accepted simultaneously and the
 *     hidden Sandpack flips between designs mid-capture.
 *   - Memory leaks from results never being cleared.
 *
 * Every test below is a pinned regression for one of those failure modes.
 * No DOM is needed — the store is pure JS state with synchronous
 * `setState`/`subscribe`, so we can drive it deterministically.
 */

beforeEach(() => {
  useScreenshotRequestStore.getState().__resetForTest();
});

afterEach(() => {
  // Belt-and-braces — test isolation matters more than test brevity.
  useScreenshotRequestStore.getState().__resetForTest();
});

describe("enqueueRequest", () => {
  it("returns a request id and stores the pending request", () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
    });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    const pending = useScreenshotRequestStore.getState().pendingRequest;
    expect(pending).toEqual({ id, projectId: "proj_1", designId: "design_1" });
  });

  it("uses the supplied id when one is provided (deterministic for tests)", () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
      id: "fixed-id",
    });
    expect(id).toBe("fixed-id");
    expect(useScreenshotRequestStore.getState().pendingRequest?.id).toBe(
      "fixed-id",
    );
  });

  it("rejects a second enqueue while one is pending", () => {
    useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
    });
    expect(() =>
      useScreenshotRequestStore.getState().enqueueRequest({
        projectId: "proj_2",
        designId: "design_2",
      }),
    ).toThrow(ScreenshotRequestBusyError);
    // The original pending must NOT be replaced — that's the whole point
    // of refusing concurrency.
    expect(
      useScreenshotRequestStore.getState().pendingRequest?.designId,
    ).toBe("design_1");
  });

  it("allows a new enqueue once the prior one is resolved + cleared", () => {
    const a = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_a",
      id: "a",
    });
    useScreenshotRequestStore
      .getState()
      .resolveRequest(a, { dataUrl: "data:image/png;base64,AAA=" });
    useScreenshotRequestStore.getState().clearRequest(a);

    expect(() =>
      useScreenshotRequestStore.getState().enqueueRequest({
        projectId: "proj_1",
        designId: "design_b",
        id: "b",
      }),
    ).not.toThrow();
    expect(
      useScreenshotRequestStore.getState().pendingRequest?.designId,
    ).toBe("design_b");
  });

  it("generates unique ids on rapid succession (no collisions)", () => {
    // We can't actually call enqueue twice without resolving the first
    // (the busy guard would throw), so we assert id uniqueness across
    // resolve+clear cycles. The ids must NOT be reused after a clear.
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const id = useScreenshotRequestStore.getState().enqueueRequest({
        projectId: "proj_1",
        designId: "design_1",
      });
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      useScreenshotRequestStore.getState().resolveRequest(id, {
        dataUrl: "data:image/png;base64,AAA=",
      });
      useScreenshotRequestStore.getState().clearRequest(id);
    }
  });
});

describe("resolveRequest", () => {
  it("stores a successful result and unblocks pending state", () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
      id: "req-1",
    });
    useScreenshotRequestStore.getState().resolveRequest(id, {
      dataUrl: "data:image/png;base64,AAA=",
    });
    expect(useScreenshotRequestStore.getState().pendingRequest).toBeNull();
    expect(useScreenshotRequestStore.getState().resultsById[id]).toEqual({
      dataUrl: "data:image/png;base64,AAA=",
    });
  });

  it("stores an error result and unblocks pending state", () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
    });
    useScreenshotRequestStore.getState().resolveRequest(id, {
      error: "bundler compile failed",
    });
    expect(useScreenshotRequestStore.getState().pendingRequest).toBeNull();
    expect(useScreenshotRequestStore.getState().resultsById[id]).toEqual({
      error: "bundler compile failed",
    });
  });

  it("does NOT clear pending when resolving a non-matching id", () => {
    // The producer might have abandoned the original request and
    // started a new one. A late resolve from the host for the OLD id
    // shouldn't yank the slot out from under the new request.
    const a = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_a",
      id: "a",
    });
    useScreenshotRequestStore.getState().resolveRequest(a, {
      dataUrl: "data:image/png;base64,AAA=",
    });
    useScreenshotRequestStore.getState().clearRequest(a);

    const b = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_b",
      id: "b",
    });
    // Late-arriving resolve for the old id `a`. Must NOT clear pending
    // for `b`.
    useScreenshotRequestStore
      .getState()
      .resolveRequest("a", { dataUrl: "data:image/png;base64,XXX=" });
    expect(useScreenshotRequestStore.getState().pendingRequest?.id).toBe(b);
  });

  it("still records the result even when pending state is mismatched", () => {
    // Symmetric to the above — a stale resolve still records the result
    // so any subscriber that genuinely cared about that id can read it.
    // (`waitForScreenshotResult` uses this.)
    useScreenshotRequestStore
      .getState()
      .resolveRequest("orphan", { error: "stale" });
    expect(
      useScreenshotRequestStore.getState().resultsById["orphan"],
    ).toEqual({ error: "stale" });
  });
});

describe("clearRequest", () => {
  it("removes the result entry", () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
    });
    useScreenshotRequestStore.getState().resolveRequest(id, {
      dataUrl: "data:image/png;base64,AAA=",
    });
    useScreenshotRequestStore.getState().clearRequest(id);
    expect(
      useScreenshotRequestStore.getState().resultsById[id],
    ).toBeUndefined();
  });

  it("clears pending state if the id matches", () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
      id: "abandoned",
    });
    // Producer timed out — clear without ever resolving.
    useScreenshotRequestStore.getState().clearRequest(id);
    expect(useScreenshotRequestStore.getState().pendingRequest).toBeNull();
  });

  it("does not touch pending state if the id doesn't match", () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
      id: "live",
    });
    useScreenshotRequestStore.getState().clearRequest("some-other-id");
    expect(useScreenshotRequestStore.getState().pendingRequest?.id).toBe(id);
  });

  it("is idempotent on unknown ids", () => {
    expect(() =>
      useScreenshotRequestStore.getState().clearRequest("never-existed"),
    ).not.toThrow();
  });
});

describe("waitForScreenshotResult", () => {
  it("resolves with the result the host posts", async () => {
    const id = useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
      id: "wait-1",
    });
    const promise = waitForScreenshotResult(id, 5_000);
    // Resolve asynchronously so we exercise the subscribe path, not the
    // synchronous fast path below.
    setTimeout(() => {
      useScreenshotRequestStore.getState().resolveRequest(id, {
        dataUrl: "data:image/png;base64,AAA=",
      });
    }, 10);
    const result = await promise;
    expect(result).toEqual({ dataUrl: "data:image/png;base64,AAA=" });
  });

  it("resolves synchronously if the result is already in the map", async () => {
    // The host might post `resolveRequest` before the producer sets up
    // its subscription (extreme warm-path case where capture finishes
    // in the same tick as enqueue). The wait must still work.
    const id = "presolved";
    useScreenshotRequestStore.getState().resolveRequest(id, {
      dataUrl: "data:image/png;base64,AAA=",
    });
    const result = await waitForScreenshotResult(id, 5_000);
    expect(result).toEqual({ dataUrl: "data:image/png;base64,AAA=" });
  });

  it("rejects on timeout if no result arrives", async () => {
    vi.useFakeTimers();
    try {
      const promise = waitForScreenshotResult("never", 1_000);
      vi.advanceTimersByTime(1_500);
      await expect(promise).rejects.toThrow(/Screenshot host didn't respond/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not double-resolve if a result arrives after timeout", async () => {
    vi.useFakeTimers();
    try {
      const promise = waitForScreenshotResult("late", 1_000);
      vi.advanceTimersByTime(1_500);
      await expect(promise).rejects.toThrow();
      // A later resolve must not throw or affect other subscribers — the
      // subscription should already be torn down.
      expect(() =>
        useScreenshotRequestStore.getState().resolveRequest("late", {
          dataUrl: "data:image/png;base64,AAA=",
        }),
      ).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not resolve early if a different id is resolved first", async () => {
    const targetId = "target";
    const promise = waitForScreenshotResult(targetId, 5_000);
    // Resolve a DIFFERENT id — must not unblock our wait.
    useScreenshotRequestStore.getState().resolveRequest("decoy", {
      dataUrl: "data:image/png;base64,DECOY=",
    });
    // Brief async tick to give the wrong subscription a chance to fire
    // erroneously.
    await new Promise((r) => setTimeout(r, 5));
    // Now resolve the right id and ensure we get THAT value.
    useScreenshotRequestStore.getState().resolveRequest(targetId, {
      dataUrl: "data:image/png;base64,RIGHT=",
    });
    const result = await promise;
    expect(result).toEqual({ dataUrl: "data:image/png;base64,RIGHT=" });
  });
});

describe("__resetForTest", () => {
  it("clears all pending and result state", () => {
    useScreenshotRequestStore.getState().enqueueRequest({
      projectId: "proj_1",
      designId: "design_1",
      id: "to-be-reset",
    });
    useScreenshotRequestStore
      .getState()
      .resolveRequest("orphan", { error: "x" });
    useScreenshotRequestStore.getState().__resetForTest();
    expect(useScreenshotRequestStore.getState().pendingRequest).toBeNull();
    expect(useScreenshotRequestStore.getState().resultsById).toEqual({});
  });
});
