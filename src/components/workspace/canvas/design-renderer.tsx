"use client";

import * as React from "react";
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
  captureRef: React.RefObject<HTMLDivElement | null>;
  /** Forwarded ref to the scrollable viewport — used by the Draw tool to
   * capture only what the user can currently see. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
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

  const isEmpty = design.files.length === 0;
  // Memoize against design.id, NOT design.files. We want a stable initial
  // `files` prop per mounted design so Sandpack's internal `useFiles` effect
  // doesn't reset its state (and the visible/active file selection) every
  // time the server pushes new file contents. Mid-session edits are pushed
  // surgically via `sandpack.updateFile` inside <DesignerInternals/>.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialFiles = React.useMemo(
    () => buildSandpackFiles(design.files),
    [design.id],
  );

  if (isEmpty) {
    return <EmptyCanvas />;
  }

  // Browser-style ⌘+ / ⌘- zoom. Scale the design visually with a CSS
  // `transform` while keeping the iframe's *internal* CSS-pixel viewport at
  // V (= the canvas pane's natural width). That way:
  //   • Pressing ⌘+ visibly enlarges everything (text, buttons, images)
  //     just like ctrl+ in Chrome makes a webpage look bigger.
  //   • The iframe's own coordinate system stays put, which keeps drawing
  //     coordinates and screenshot crops simple to reason about.
  //   • The outer wrapper is sized to the post-scale dimensions so the
  //     parent's overflow:auto can hand the user a scrollbar when they've
  //     zoomed past 100%, and shrinks below the viewport at <100% so the
  //     design doesn't pretend to fill space it isn't actually using.
  return (
    <div ref={viewportRef} className="h-full w-full overflow-auto bg-canvas">
      <div
        className="relative"
        style={{
          width: `${100 * zoom}%`,
          height: `${100 * zoom}%`,
        }}
      >
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
            />
          </SandpackProvider>
          <CanvasLoadingOverlay key={`loader-${design.id}`} />
          <DrawingOverlay projectId={projectId} />
        </div>
      </div>
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
}: {
  projectId: string;
  designFiles: DesignFileDTO[];
}) {
  const { sandpack } = useSandpack();
  const tool = useWorkspaceStore((s) => s.tool);
  const addPendingTag = useWorkspaceStore((s) => s.addPendingTag);
  const sessionId = useWorkspaceStore(
    (s) => s.activeSessionByProject[projectId],
  );

  // Push file changes to the live bundler. Skipping the first run avoids a
  // redundant updateFile call right after mount, when Sandpack already has
  // the files from the initial `files` prop.
  const isFirstRun = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const designPaths = new Set(designFiles.map((f) => f.path));
    for (const f of designFiles) {
      if (SANDPACK_RUNTIME_PATHS.has(f.path)) continue;
      const current = sandpack.files[f.path]?.code;
      if (current !== f.content) {
        sandpack.updateFile(f.path, f.content);
      }
    }
    // Drop files the agent removed server-side. Skip the runtime scaffolding
    // explicitly — Sandpack's `addPackageJSONIfNeeded` rewrites
    // `/package.json` during init and strips its `hidden` flag, so checking
    // `sandpack.files[path]?.hidden` would incorrectly let us delete it,
    // which then makes the bundler throw `"dependencies" was not specified`.
    for (const path of Object.keys(sandpack.files)) {
      if (designPaths.has(path)) continue;
      if (SANDPACK_RUNTIME_PATHS.has(path)) continue;
      if (sandpack.files[path]?.hidden) continue;
      sandpack.deleteFile(path);
    }
    // We intentionally read sandpack from the closure on every effect run so
    // the latest files map is compared. Including `sandpack` in deps would
    // trigger this on every Sandpack state change (selection, etc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designFiles]);

  // Forward design-tagger click messages from the iframe to the host
  // workspace store. Highlight mode is sticky — the user stays in the mode
  // until they click the toolbar button again or hit ⌘⇧H, so they can tag
  // several elements in a row without re-entering it each time.
  React.useEffect(() => {
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

  React.useEffect(() => {
    const iframe = document.querySelector(
      ".sp-preview-iframe",
    ) as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "design-tagger:set", active: tool === "tag" },
      "*",
    );
  }, [tool]);

  return null;
}
