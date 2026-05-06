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
  }, []);

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
      if (sandpack.files[path]?.hidden) continue;
      toDelete.push(path);
    }

    if (toUpdate.length === 0 && toDelete.length === 0) return;

    // Signal the overlay to re-appear while Sandpack recompiles.
    onFilesUpdatingRef.current?.();

    for (const f of toUpdate) sandpack.updateFile(f.path, f.content);
    for (const path of toDelete) sandpack.deleteFile(path);
  }, [designFiles]);

  // Forward design-tagger click messages from the iframe to the host
  // workspace store.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      // Guard: only accept messages from a known Sandpack preview iframe.
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
  // inside the Sandpack preview iframe. 
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
