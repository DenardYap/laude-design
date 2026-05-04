"use client";

import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  MousePointer,
  Pencil,
  Redo2,
  SendHorizonal,
  Slash,
  Sliders,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { match } from "ts-pattern";

import {
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { DrawingStyleControls } from "@/components/workspace/canvas/drawing/drawing-style-controls";
import {
  selectCanRedo,
  selectCanUndo,
  selectShapes,
  selectTool,
  useDrawingStore,
  type DrawTool,
} from "@/stores/drawing-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface DrawingShapeBarProps {
  projectId: string;
  /** Used to position the bar over the design viewport (not the chat pane). */
  viewportRef: RefObject<HTMLDivElement | null>;
  onSend: () => void;
  sending: boolean;
  /**
   * Funnel point for "leave Draw mode" — opens the discard-confirm dialog
   * if there are shapes to lose. Lives at the workspace level so every
   * exit path (X button, Esc, the canvas-toolbar Pencil, ⌘⇧D) shares it.
   */
  onRequestExit: () => void;
}

const SHAPE_TOOLS: { tool: DrawTool; icon: ReactNode; label: string; key: string }[] = [
  { tool: "none", icon: <MousePointer className="size-4" />, label: "Select", key: "1" },
  { tool: "rectangle", icon: <Square className="size-4" />, label: "Rectangle", key: "2" },
  { tool: "diamond", icon: <Diamond className="size-4" />, label: "Diamond", key: "3" },
  { tool: "ellipse", icon: <Circle className="size-4" />, label: "Ellipse", key: "4" },
  { tool: "arrow", icon: <ArrowUpRight className="size-4" />, label: "Arrow", key: "5" },
  { tool: "line", icon: <Slash className="size-4" />, label: "Line", key: "6" },
  { tool: "pencil", icon: <Pencil className="size-4" />, label: "Pencil", key: "7" },
  { tool: "eraser", icon: <Eraser className="size-4" />, label: "Eraser", key: "0" },
];

const KEY_TO_TOOL: Record<string, DrawTool> = SHAPE_TOOLS.reduce(
  (acc, { key, tool }) => {
    acc[key] = tool;
    return acc;
  },
  {} as Record<string, DrawTool>,
);

/**
 * Floating shape bar pinned to the bottom-center of the design viewport.
 * Visible only while the workspace tool is `draw`. Owns all keyboard
 * shortcuts so they automatically tear down when the user exits Draw mode
 * (no orphaned `keydown` handlers swallowing Cmd-Z elsewhere).
 */
export function DrawingShapeBar({
  projectId,
  viewportRef,
  onSend,
  sending,
  onRequestExit,
}: DrawingShapeBarProps) {
  const workspaceTool = useWorkspaceStore((s) => s.tool);
  const drawTool = useDrawingStore(selectTool(projectId));
  const canUndo = useDrawingStore(selectCanUndo(projectId));
  const canRedo = useDrawingStore(selectCanRedo(projectId));
  const shapes = useDrawingStore(selectShapes(projectId));
  const setTool = useDrawingStore((s) => s.setTool);
  const undo = useDrawingStore((s) => s.undo);
  const redo = useDrawingStore((s) => s.redo);
  const clear = useDrawingStore((s) => s.clear);

  const active = workspaceTool === "draw";

  // Track the viewport's bounding box so the bar floats over the canvas
  // and follows it when the user resizes the chat panel. We poll on rAF
  // because there's no single event that catches every relevant layout
  // change (resize observers don't fire on parent flex resizes from
  // react-resizable-panels, etc).
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!active) {
      setBounds(null);
      return;
    }
    let raf = 0;
    let lastSerialized = "";
    const tick = () => {
      const r = viewportRef.current?.getBoundingClientRect();
      if (r) {
        const serialized = `${r.left},${r.top},${r.width},${r.height}`;
        if (serialized !== lastSerialized) {
          lastSerialized = serialized;
          setBounds(r);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, viewportRef]);

  // Keyboard shortcuts. Mounted at document level only while Draw mode is
  // active so we don't conflict with the rest of the app. Inputs/textareas
  // are exempted so the user can still type (e.g. in chat) without losing
  // their drawing.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo(projectId);
        } else if (canUndo) {
          undo(projectId);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onRequestExit();
        return;
      }
      const next = KEY_TO_TOOL[e.key];
      if (next !== undefined && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setTool(projectId, next);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, projectId, canUndo, canRedo, undo, redo, setTool, onRequestExit]);

  if (!active || !bounds) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: bounds.left + bounds.width / 2,
        top: bounds.top + bounds.height - 16,
        transform: "translate(-50%, -100%)",
        // Higher than Tooltip / Popover (z-50) and the Sandpack iframe so the
        // bar always stays in front of the canvas content.
        zIndex: 100,
      }}
      className="pointer-events-none"
    >
      <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-1 shadow-lg">
        {SHAPE_TOOLS.map((entry) => (
          <ToolButton
            key={entry.tool}
            label={entry.label}
            shortcut={entry.key}
            icon={entry.icon}
            active={drawTool === entry.tool}
            onClick={() => setTool(projectId, entry.tool)}
          />
        ))}

        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        {/* Style popover — opens above the bar so it never obscures the
            design while the bar itself stays put. Only visible on demand
            (vs. the previous always-on right-side panel). */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <IconButton
                  aria-label="Style options"
                  className="size-8 rounded-full"
                  icon={<Sliders className="size-4" />}
                />
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Style options</TooltipContent>
          </Tooltip>
          <PopoverContent
            side="top"
            sideOffset={12}
            align="center"
            className="z-[110] w-64"
          >
            <DrawingStyleControls projectId={projectId} />
          </PopoverContent>
        </Popover>

        <ToolButton
          label="Undo"
          shortcut={shortcutChord("Z")}
          icon={<Undo2 className="size-4" />}
          onClick={() => undo(projectId)}
          disabled={!canUndo}
        />
        <ToolButton
          label="Redo"
          shortcut={shortcutChord("⇧Z")}
          icon={<Redo2 className="size-4" />}
          onClick={() => redo(projectId)}
          disabled={!canRedo}
        />
        <ToolButton
          label="Clear all"
          icon={<Trash2 className="size-4" />}
          onClick={() => clear(projectId)}
          disabled={shapes.length === 0}
        />

        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              aria-label="Send sketch to chat"
              variant="primary"
              className="size-8 rounded-full"
              icon={<SendHorizonal className="size-3.5" />}
              onClick={onSend}
              disabled={sending || shapes.length === 0}
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="flex flex-col items-center gap-0.5">
            <span>Send sketch to chat</span>
            <span className="text-[10px] opacity-60">captures the visible viewport</span>
          </TooltipContent>
        </Tooltip>

        <ToolButton
          label="Exit draw mode"
          shortcut="Esc"
          icon={<X className="size-4" />}
          onClick={onRequestExit}
        />
      </div>
    </div>
  );
}

interface ToolButtonProps {
  label: string;
  shortcut?: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ label, shortcut, icon, active, disabled, onClick }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "size-8 rounded-full",
            active && "bg-brand-soft text-ink ring-2 ring-brand",
          )}
          icon={icon}
          onClick={onClick}
          disabled={disabled}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col items-center gap-0.5">
        <span>{label}</span>
        {shortcut ? (
          <span className="text-[10px] opacity-60">{shortcut}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function shortcutChord(key: string): string {
  return match(getModSymbol())
    .with("meta", () => `⌘${key}`)
    .with("ctrl", () => `Ctrl+${key}`)
    .exhaustive();
}

function getModSymbol(): "meta" | "ctrl" {
  if (typeof navigator === "undefined") return "meta";
  return /Mac|iPhone|iPad/i.test(navigator.platform) ? "meta" : "ctrl";
}
