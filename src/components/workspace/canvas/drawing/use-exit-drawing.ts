"use client";

import * as React from "react";

import { selectShapes, useDrawingStore } from "@/stores/drawing-store";
import { type ToolMode, useWorkspaceStore } from "@/stores/workspace-store";

export interface ExitDrawingControl {
  /**
   * Request a workspace-tool transition. If we're currently in Draw mode
   * AND there are unsent shapes, we open a discard-confirm; otherwise the
   * transition runs immediately (and `after` fires synchronously).
   *
   * Pass `after` for actions that aren't pure tool changes — e.g. "take a
   * screenshot" still wants to clear drawings first, but the screenshot
   * helper sets the tool itself.
   */
  requestSwitch: (next: ToolMode, after?: () => void) => void;
  /** Shorthand for `requestSwitch("idle")`. Used by Esc / X / Pencil button. */
  requestExit: () => void;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  /** Discards drawings + applies the pending switch. Wired to the dialog. */
  confirmExit: () => void;
}

/**
 * Single source of truth for every "leave Draw mode" trigger so each one
 * funnels through the same forcing-function (per design.mdc Lock-ins) — no
 * exit path can silently discard the user's sketch. Covers:
 *   • Esc / X button / Pencil toggle / ⌘⇧D       → requestExit()
 *   • Highlight toggle / Screenshot dropdown / etc → requestSwitch(next, …)
 */
export function useExitDrawing(projectId: string): ExitDrawingControl {
  const shapes = useDrawingStore(selectShapes(projectId));
  const setWorkspaceTool = useWorkspaceStore((s) => s.setTool);
  const clear = useDrawingStore((s) => s.clear);

  const [confirmOpen, setConfirmOpenRaw] = React.useState(false);
  const hasShapes = shapes.length > 0;

  // Stash the pending transition (and any follow-up action like "fire the
  // screenshot helper") in a ref so they survive the dialog round-trip
  // without forcing a re-render on every keystroke.
  const pendingRef = React.useRef<{
    next: ToolMode;
    after: (() => void) | null;
  } | null>(null);

  const setConfirmOpen = React.useCallback((open: boolean) => {
    setConfirmOpenRaw(open);
    // Dismissing the dialog without confirming = user changed their mind.
    // Drop the pending transition so the next exit attempt starts fresh.
    if (!open) pendingRef.current = null;
  }, []);

  const requestSwitch = React.useCallback(
    (next: ToolMode, after?: () => void) => {
      if (hasShapes) {
        pendingRef.current = { next, after: after ?? null };
        setConfirmOpenRaw(true);
        return;
      }
      setWorkspaceTool(next);
      after?.();
    },
    [hasShapes, setWorkspaceTool],
  );

  const requestExit = React.useCallback(
    () => requestSwitch("idle"),
    [requestSwitch],
  );

  const confirmExit = React.useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    clear(projectId);
    setWorkspaceTool(pending?.next ?? "idle");
    setConfirmOpenRaw(false);
    pending?.after?.();
  }, [clear, projectId, setWorkspaceTool]);

  return {
    requestSwitch,
    requestExit,
    confirmOpen,
    setConfirmOpen,
    confirmExit,
  };
}
