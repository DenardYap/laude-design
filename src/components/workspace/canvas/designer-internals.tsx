"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { match } from "ts-pattern";
import { useSandpack } from "@codesandbox/sandpack-react";

import type { DesignFileDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { SANDPACK_RUNTIME_PATHS } from "@/components/workspace/canvas/utils/sandpack-files";
import type { DesignerInternalsProps } from "@/components/workspace/canvas/types/design-renderer";

/**
 * Lives inside SandpackProvider so it can call `updateFile` directly on the
 * bundler. Two responsibilities:
 *   1. Mirror server-side file changes into the bundler without remounting
 *      the iframe — `design.files` updates from `router.refresh()` get diffed
 *      and pushed via `updateFile`, which is what makes the canvas reflect
 *      the agent's edits in real time.
 *   2. Bridge the design-tagger postMessages between the host page and the
 *      preview iframe.
 */
export function DesignerInternals({
  projectId,
  designFiles,
  onReady,
  onFilesUpdating,
}: DesignerInternalsProps) {
  const { sandpack, listen } = useSandpack();
  const tool = useWorkspaceStore((s) => s.tool);
  const addPendingTag = useWorkspaceStore((s) => s.addPendingTag);
  const sessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[projectId],
  );

  // Signal the overlay to dismiss once Sandpack finishes compilation.
  // We use the same signal Sandpack's own LoadingOverlay uses internally:
  // `message.type === "done"` emitted by the sandpack client. This fires
  // on both initial compilation and HMR recompilations — unlike
  // `sandpack.status === "running"` which fires as soon as the bundler
  // *process* starts, well before the code has actually compiled.
  const onReadyRef = useRef(onReady);
  useLayoutEffect(() => {
    onReadyRef.current = onReady;
  });
  useEffect(() => {
    const unsubscribe = listen((message) => {
      if (message.type === "done") {
        onReadyRef.current?.();
      }
    });
    return unsubscribe;
    // `listen` is stable (memoised in Sandpack context); intentionally omitted
    // from the deps array to avoid re-subscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push file changes to the live bundler. Skipping the first run avoids a
  // redundant updateFile call right after mount, when Sandpack already has
  // the files from the initial `files` prop.
  const isFirstRun = useRef(true);
  const onFilesUpdatingRef = useRef(onFilesUpdating);
  useLayoutEffect(() => {
    onFilesUpdatingRef.current = onFilesUpdating;
  });
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    // Diff first. Only push changes that actually differ so that:
    //   • React Strict Mode double-invocations (same files, re-run) are no-ops.
    //   • router.refresh() that returns the same file content (new array
    //     reference, same bytes) doesn't flash the loading overlay.
    const designPaths = new Set(designFiles.map((f) => f.path));

    const toUpdate: DesignFileDTO[] = [];
    for (const f of designFiles) {
      if (SANDPACK_RUNTIME_PATHS.has(f.path)) continue;
      const current = sandpack.files[f.path]?.code;
      if (current !== f.content) toUpdate.push(f);
    }

    const toDelete: string[] = [];
    for (const path of Object.keys(sandpack.files)) {
      if (designPaths.has(path)) continue;
      if (SANDPACK_RUNTIME_PATHS.has(path)) continue;
      // Skip the runtime scaffolding — Sandpack's `addPackageJSONIfNeeded`
      // rewrites `/package.json` during init and strips its `hidden` flag,
      // so checking `sandpack.files[path]?.hidden` would incorrectly let us
      // delete it, making the bundler throw
      // `"dependencies" was not specified`.
      if (sandpack.files[path]?.hidden) continue;
      toDelete.push(path);
    }

    // Nothing actually changed — skip overlay flash and bundler churn.
    if (toUpdate.length === 0 && toDelete.length === 0) return;

    // Signal the overlay to re-appear while Sandpack recompiles. When
    // compilation finishes the 'done' listener fires onReady and the
    // overlay fades out automatically.
    onFilesUpdatingRef.current?.();

    for (const f of toUpdate) sandpack.updateFile(f.path, f.content);
    for (const path of toDelete) sandpack.deleteFile(path);
    // We intentionally read sandpack from the closure on every effect run so
    // the latest files map is compared. Including `sandpack` in deps would
    // trigger this on every Sandpack state change (selection, etc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designFiles]);

  // Forward design-tagger click messages from the iframe to the host
  // workspace store. Highlight mode is sticky — the user stays in the mode
  // until they click the toolbar button again or hit ⌘⇧H, so they can tag
  // several elements in a row without re-entering it each time.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      // Guard: only accept messages from a known Sandpack preview iframe.
      // Without this check, AI-generated code running inside the iframe (or
      // any other window with a reference to this page) could send arbitrary
      // design-tagger:click payloads and inject text into the user's chat.
      const iframes = document.querySelectorAll<HTMLIFrameElement>(".sp-preview-iframe");
      const fromKnownIframe = Array.from(iframes).some(
        (f) => f.contentWindow != null && ev.source === f.contentWindow,
      );
      if (!fromKnownIframe) return;

      match(ev.data as { type?: string; selector?: string; text?: string })
        .with({ type: "design-tagger:click" }, (d) => {
          if (!sessionId) return;
          addPendingTag(sessionId, {
            selector: d.selector ?? "",
            text: d.text ?? "",
          });
        })
        .otherwise(() => {});
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sessionId, addPendingTag]);

  useEffect(() => {
    const iframe = document.querySelector(
      ".sp-preview-iframe",
    ) as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "design-tagger:set", active: tool === "tag" },
      "*",
    );
  }, [tool]);

  // Keep keyboard focus on the parent window so Ctrl+1/2/3 shortcuts (and
  // all other canvas hotkeys) continue to fire even after the user clicks
  // inside the Sandpack preview iframe. We only steal focus back from the
  // specific Sandpack iframe — not from every iframe in the page — to avoid
  // interfering with anything else.
  useEffect(() => {
    const onBlur = () => {
      requestAnimationFrame(() => {
        const el = document.activeElement;
        if (
          el instanceof HTMLIFrameElement &&
          el.classList.contains("sp-preview-iframe")
        ) {
          window.focus();
        }
      });
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  return null;
}
