"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { match } from "ts-pattern";

import type { DesignDTO, DesignFileDTO } from "@/lib/workspace/types";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  buildSandpackFiles,
  SANDPACK_RUNTIME_PATHS,
} from "@/components/workspace/canvas/sandpack-files";
import { CanvasLoadingOverlay } from "@/components/workspace/canvas/canvas-loading-overlay";
import { DrawingOverlay } from "@/components/workspace/canvas/drawing/drawing-overlay";
import { EmptyCanvas } from "@/components/workspace/canvas/empty-canvas";
import { useCanvasWheelZoom } from "@/components/workspace/canvas/use-canvas-wheel-zoom";

interface DesignRendererProps {
  projectId: string;
  design: DesignDTO;
  /** Forwarded ref so the screenshot tool can capture this element. */
  captureRef: RefObject<HTMLDivElement | null>;
  /** Forwarded ref to the scrollable viewport — used by the Draw tool to
   * capture only what the user can currently see. */
  viewportRef: RefObject<HTMLDivElement | null>;
}

// Stable references so SandpackProvider's `useFiles`/`useClient` effects don't
// fire on every parent re-render (they diff `props.customSetup` and
// `props.options` by reference).
const SANDPACK_CUSTOM_SETUP = { entry: "/index.tsx" } as const;
const SANDPACK_OPTIONS = {
  classes: { "sp-preview-iframe": "sp-preview-iframe" },
  recompileMode: "delayed" as const,
  recompileDelay: 250,
  // Inject Tailwind via Sandpack's documented `externalResources` hook
  // instead of relying on a custom `/public/index.html`. The runtime bundler
  // doesn't always honour public/index.html overrides, which is why every
  // generated design was rendering with un-styled browser defaults.
  externalResources: ["https://cdn.tailwindcss.com"],
};

export function DesignRenderer({
  projectId,
  design,
  captureRef,
  viewportRef,
}: DesignRendererProps) {
  const zoom = useWorkspaceStore((s) => s.zoom);

  // ⌘/ctrl + wheel = zoom (browser pinch on trackpad fires the same event).
  useCanvasWheelZoom(viewportRef);

  // Overlay control: `loadGen` is bumped whenever we want the loading overlay
  // to re-appear (design switch or agent file update). `sandpackReady` flips
  // to true once Sandpack signals compilation is done, dismissing the overlay.
  const [loadGen, setLoadGen] = useState(0);
  const [sandpackReady, setSandpackReady] = useState(false);

  // Reset both flags whenever the active design switches so the overlay
  // shows fresh for the new design's compilation cycle.
  useEffect(() => {
    setLoadGen(0);
    setSandpackReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.id]);

  const handleSandpackReady = useCallback(() => {
    setSandpackReady(true);
  }, []);

  const handleFilesUpdating = useCallback(() => {
    setLoadGen((g) => g + 1);
    setSandpackReady(false);
  }, []);

  const isEmpty = design.files.length === 0;
  // Memoize against design.id, NOT design.files. We want a stable initial
  // `files` prop per mounted design so Sandpack's internal `useFiles` effect
  // doesn't reset its state (and the visible/active file selection) every
  // time the server pushes new file contents. Mid-session edits are pushed
  // surgically via `sandpack.updateFile` inside <DesignerInternals/>.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialFiles = useMemo(
    () => buildSandpackFiles(design.files),
    [design.id],
  );

  if (isEmpty) {
    return <EmptyCanvas />;
  }

  // Responsive viewport simulation with scale-to-fit.
  //
  // captureRef is sized to `(1/zoom) × 100%` of the canvas pane, so the
  // Sandpack iframe's CSS viewport is `pane / zoom`. At zoom=2 (pressing +)
  // the iframe sees half the pane width → mobile/narrow breakpoints fire and
  // the content is scaled up 2× to fill the canvas (zoomed-in feel).
  // At zoom=0.5 (pressing -) the iframe sees 2× the pane width → desktop
  // breakpoints fire and the content is scaled down to fit (zoomed-out feel).
  //
  // `transform: scale(zoom)` brings the (1/zoom)-sized element back to fill
  // the canvas pane visually, so the design always fills the pane with no
  // horizontal scrollbar.
  //
  // Because the CSS transform is scale(zoom), coordinate math in the drawing
  // overlay and screenshot helpers must divide by zoom to convert from visual
  // (post-transform) coordinates back to iframe CSS pixels.
  return (
    <div ref={viewportRef} className="relative h-full w-full overflow-hidden bg-canvas">
        <div
          ref={captureRef}
          className="relative origin-top-left"
          style={{
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <SandpackProvider
            // Remount only when switching between designs. Same-id file edits
            // flow through `useFiles` and update the bundler in place — see
            // the SandpackFileSync child below.
            key={design.id}
            template="react-ts"
            files={initialFiles}
            options={SANDPACK_OPTIONS}
            customSetup={SANDPACK_CUSTOM_SETUP}
            theme="light"
            // The wrapper div needs an explicit size so the inner SandpackLayout
            // (which is a flex column) has a height to fill.
            style={{ height: "100%", width: "100%", display: "flex" }}
          >
            <SandpackLayout
              className="!h-full !w-full !rounded-none !border-0 !bg-transparent"
              style={{ height: "100%", width: "100%", flex: 1 }}
            >
              <SandpackPreview
                showOpenInCodeSandbox={false}
                showRefreshButton={false}
                showRestartButton={false}
                showNavigator={false}
                showSandpackErrorOverlay
                style={{ height: "100%", width: "100%", border: 0, flex: 1 }}
              />
            </SandpackLayout>
            <DesignerInternals
              projectId={projectId}
              designFiles={design.files}
              onReady={handleSandpackReady}
              onFilesUpdating={handleFilesUpdating}
            />
          </SandpackProvider>
          <DrawingOverlay projectId={projectId} />
        </div>
      {/* Sits outside the scaled captureRef so the overlay is never distorted by the viewport simulation transform */}
      <CanvasLoadingOverlay
        key={`${design.id}-${loadGen}`}
        ready={sandpackReady}
      />
    </div>
  );
}

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
function DesignerInternals({
  projectId,
  designFiles,
  onReady,
  onFilesUpdating,
}: {
  projectId: string;
  designFiles: DesignFileDTO[];
  onReady?: () => void;
  onFilesUpdating?: () => void;
}) {
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
