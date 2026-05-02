"use client";

import * as React from "react";
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
}

export function CanvasToolbar({
  onCaptureFull,
  onStartAreaCapture,
  onRequestSwitch,
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

  // Local helpers so each button has one obvious code path:
  //  • Not in Draw mode → run the action directly.
  //  • In Draw mode    → delegate to the discard-confirm flow.
  const switchToolGuarded = React.useCallback(
    (next: ToolMode) => {
      if (tool === "draw") {
        onRequestSwitch(next);
      } else {
        setTool(next);
      }
    },
    [tool, setTool, onRequestSwitch],
  );
  const runActionGuarded = React.useCallback(
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

  const toggleTag = React.useCallback(
    () => switchToolGuarded(tool === "tag" ? "idle" : "tag"),
    [tool, switchToolGuarded],
  );
  const toggleDraw = React.useCallback(() => {
    if (tool === "draw") {
      onRequestSwitch("idle");
    } else {
      setTool("draw");
    }
  }, [tool, setTool, onRequestSwitch]);
  const handleCaptureFull = React.useCallback(
    () => runActionGuarded(onCaptureFull),
    [runActionGuarded, onCaptureFull],
  );
  const handleStartAreaCapture = React.useCallback(
    () => runActionGuarded(onStartAreaCapture),
    [runActionGuarded, onStartAreaCapture],
  );

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // ⌘⇧ tool toggles. Kept on the shifted layer so we don't fight
      // ⌘+ / ⌘- below (which need to fire WITHOUT shift).
      if (e.shiftKey) {
        if (e.key === "H" || e.key === "h") {
          e.preventDefault();
          toggleTag();
        } else if (e.key === "S" || e.key === "s") {
          e.preventDefault();
          handleCaptureFull();
        } else if (e.key === "D" || e.key === "d") {
          e.preventDefault();
          toggleDraw();
        }
        return;
      }

      // ⌘+ / ⌘- / ⌘0 — mirror browser zoom shortcuts so muscle memory
      // works on the canvas. Accept "+" and "=" (same physical key on US
      // layouts) and "-" / "_" so shift state doesn't matter to the user.
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
  }, [toggleTag, toggleDraw, handleCaptureFull, zoomIn, zoomOut, resetZoom]);

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
          <span className="text-[10px] opacity-60">⌘⇧H</span>
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <IconButton
                aria-label="Screenshot"
                className={cn(
                  "size-7",
                  tool === "screenshot-area" && "bg-brand-soft text-ink",
                )}
                icon={<Camera className="size-3.5" />}
              />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
            <span>Screenshot</span>
            <span className="text-[10px] opacity-60">⌘⇧S for full canvas</span>
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
          <span className="text-[10px] opacity-60">⌘⇧D</span>
        </TooltipContent>
      </Tooltip>

      <div className="ml-1 flex items-center rounded-md border border-border bg-background">
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              aria-label="Zoom out"
              className="size-7 rounded-r-none border-0"
              icon={<Minus className="size-3.5" />}
              onClick={zoomOut}
              disabled={atMinZoom}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
            <span>Zoom out</span>
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
                  aria-label={`Zoom level ${Math.round(zoom * 100)}%`}
                >
                  {Math.round(zoom * 100)}%
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
              <span>Zoom level</span>
              <span className="text-[10px] opacity-60">⌘0 to reset</span>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-32">
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
              aria-label="Zoom in"
              className="size-7 rounded-l-none border-0"
              icon={<Plus className="size-3.5" />}
              onClick={zoomIn}
              disabled={atMaxZoom}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex flex-col items-center gap-0.5">
            <span>Zoom in</span>
            <span className="text-[10px] opacity-60">⌘+</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export type { CanvasToolbarProps };
