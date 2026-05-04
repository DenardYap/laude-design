"use client";

import { useCallback, useEffect, useState } from 'react';
import { Camera, Minus, MousePointerClick, Pencil, Plus } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ExitDrawingControl } from "@/components/workspace/canvas/drawing/use-exit-drawing";
import { type ToolMode, ZOOM_LEVELS, useWorkspaceStore } from "@/stores/workspace-store";

interface CanvasToolbarProps {
  onCaptureFull: () => void;
  onStartAreaCapture: () => void;
  /**
   * Funnel for every workspace-tool transition. Lives at the workspace
   * level so the same discard-confirm dialog protects every exit-from-draw
   * path — toggling Highlight, taking a screenshot, or just hitting Esc all
   * route through here. A no-op when we're not currently in Draw mode.
   */
  onRequestSwitch: ExitDrawingControl["requestSwitch"];
  /** Disables screenshot controls when no design content has been rendered yet. */
  isCanvasEmpty?: boolean;
}

export function CanvasToolbar({
  onCaptureFull,
  onStartAreaCapture,
  onRequestSwitch,
  isCanvasEmpty = false,
}: CanvasToolbarProps) {
  const tool = useWorkspaceStore((s) => s.tool);
  const setTool = useWorkspaceStore((s) => s.setTool);
  const zoom = useWorkspaceStore((s) => s.zoom);
  const setZoom = useWorkspaceStore((s) => s.setZoom);
  const zoomIn = useWorkspaceStore((s) => s.zoomIn);
  const zoomOut = useWorkspaceStore((s) => s.zoomOut);
  const resetZoom = useWorkspaceStore((s) => s.resetZoom);

  const atMinZoom = zoom <= ZOOM_LEVELS[0]! + 1e-6;
  const atMaxZoom = zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]! - 1e-6;

  const [screenshotOpen, setScreenshotOpen] = useState(false);

  // Local helpers so each button has one obvious code path:
  //  • Not in Draw mode → run the action directly.
  //  • In Draw mode    → delegate to the discard-confirm flow.
  const switchToolGuarded = useCallback(
    (next: ToolMode) => {
      if (tool === "draw") {
        onRequestSwitch(next);
      } else {
        setTool(next);
      }
    },
    [tool, setTool, onRequestSwitch],
  );
  const runActionGuarded = useCallback(
    (action: () => void) => {
      if (tool === "draw") {
        // Switch back to idle first so the action sees a clean slate; many
        // capture helpers internally call setTool("idle") in their finally
        // blocks anyway, this just makes the intermediate state explicit.
        onRequestSwitch("idle", action);
      } else {
        action();
      }
    },
    [tool, onRequestSwitch],
  );

  const toggleTag = useCallback(
    () => switchToolGuarded(tool === "tag" ? "idle" : "tag"),
    [tool, switchToolGuarded],
  );
  const toggleDraw = useCallback(() => {
    if (tool === "draw") {
      onRequestSwitch("idle");
    } else {
      setTool("draw");
    }
  }, [tool, setTool, onRequestSwitch]);
  const handleCaptureFull = useCallback(
    () => runActionGuarded(onCaptureFull),
    [runActionGuarded, onCaptureFull],
  );
  const handleStartAreaCapture = useCallback(
    () => runActionGuarded(onStartAreaCapture),
    [runActionGuarded, onStartAreaCapture],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only fire when the browser window itself is focused — skip when the
      // user is typing inside a text input, textarea, or contenteditable.
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Ctrl+1 / Ctrl+2 / Ctrl+3 — tool shortcuts (no shift required).
      if (!e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          toggleTag();
          return;
        } else if (e.key === "2") {
          e.preventDefault();
          if (!isCanvasEmpty) setScreenshotOpen(true);
          return;
        } else if (e.key === "3") {
          e.preventDefault();
          toggleDraw();
          return;
        }
      }

      // ⌘+ / ⌘- / ⌘0 — simulate wider/narrower screen. Accept "+" and "="
      // (same physical key on US layouts) and "-" / "_" so shift state
      // doesn't matter to the user.
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleTag, toggleDraw, zoomIn, zoomOut, resetZoom]);

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="Highlight element"
            aria-pressed={tool === "tag"}
            className={cn("size-7", tool === "tag" && "bg-brand-soft text-ink")}
            icon={<MousePointerClick className="size-3.5" />}
            onClick={toggleTag}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
          <span>{tool === "tag" ? "Click element to highlight" : "Highlight element"}</span>
          <span className="text-[10px] opacity-60">Ctrl+1</span>
        </TooltipContent>
      </Tooltip>

      <DropdownMenu open={screenshotOpen} onOpenChange={isCanvasEmpty ? undefined : setScreenshotOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <IconButton
                aria-label="Screenshot"
                disabled={isCanvasEmpty}
                className={cn(
                  "size-7",
                  tool === "screenshot-area" && "bg-brand-soft text-ink",
                )}
                icon={<Camera className="size-3.5" />}
              />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
            <span>{isCanvasEmpty ? "No content to screenshot" : "Screenshot"}</span>
            {!isCanvasEmpty && <span className="text-[10px] opacity-60">Ctrl+2</span>}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => handleCaptureFull()}>
            Capture full canvas
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleStartAreaCapture()}>
            Select area to capture
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <IconButton
            aria-label="Draw on canvas"
            aria-pressed={tool === "draw"}
            className={cn(
              "size-7",
              tool === "draw" && "bg-brand-soft text-ink",
            )}
            icon={<Pencil className="size-3.5" />}
            onClick={toggleDraw}
          />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
          <span>{tool === "draw" ? "Exit draw mode" : "Draw on canvas"}</span>
          <span className="text-[10px] opacity-60">Ctrl+3</span>
        </TooltipContent>
      </Tooltip>

      <div className="ml-1 flex items-center rounded-md border border-border bg-background">
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              aria-label="Simulate narrower screen"
              className="size-7 rounded-r-none border-0"
              icon={<Minus className="size-3.5" />}
              onClick={zoomOut}
              disabled={atMinZoom}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
            <span>Narrower screen</span>
            <span className="text-[10px] opacity-60">⌘−</span>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-12 rounded-none border-x border-border px-0 text-xs tabular-nums"
                  aria-label={`Screen width: ${Math.round(zoom * 100)}% of canvas`}
                >
                  {Math.round(zoom * 100)}%
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
              <span>Screen width</span>
              <span className="text-[10px] opacity-60">⌘0 to reset</span>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onSelect={() => resetZoom()}>
              Reset to 100%
              <span className="ml-auto text-[10px] text-ink-muted">⌘0</span>
            </DropdownMenuItem>
            <div className="my-1 h-px bg-border" />
            {ZOOM_LEVELS.map((z) => (
              <DropdownMenuItem
                key={z}
                onSelect={() => setZoom(z)}
                className={cn(z === zoom && "font-semibold")}
              >
                {Math.round(z * 100)}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              aria-label="Simulate wider screen"
              className="size-7 rounded-l-none border-0"
              icon={<Plus className="size-3.5" />}
              onClick={zoomIn}
              disabled={atMaxZoom}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
            <span>Wider screen</span>
            <span className="text-[10px] opacity-60">⌘+</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export type { CanvasToolbarProps };
