"use client";

import { create } from "zustand";

export type DrawTool =
  | "none"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "pencil"
  | "eraser";

export type StrokeStyle = "solid" | "dashed" | "dotted";
// rough.js roughness 0.5 / 1.5 / 3 — names cribbed from Excalidraw so the UI
// label feels familiar.
export type Sloppiness = "architect" | "artist" | "cartoonist";
export type Edges = "sharp" | "round";

export interface DrawStyle {
  strokeColor: string;
  /** "transparent" or a hex; "transparent" → no fill on rough shapes. */
  backgroundColor: string;
  strokeWidth: 1 | 2 | 4;
  strokeStyle: StrokeStyle;
  sloppiness: Sloppiness;
  edges: Edges;
  /** 0..100 — applied as SVG `opacity` on the shape group. */
  opacity: number;
}

interface BoxShape {
  id: string;
  type: "rectangle" | "diamond" | "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  style: DrawStyle;
}

interface LinearShape {
  id: string;
  type: "arrow" | "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  seed: number;
  style: DrawStyle;
}

interface PencilShape {
  id: string;
  type: "pencil";
  points: { x: number; y: number }[];
  seed: number;
  style: DrawStyle;
}

export type Shape = BoxShape | LinearShape | PencilShape;

export const DEFAULT_DRAW_STYLE: DrawStyle = {
  strokeColor: "#e03131",
  backgroundColor: "transparent",
  strokeWidth: 2,
  strokeStyle: "solid",
  sloppiness: "artist",
  edges: "round",
  opacity: 100,
};

// Stable empty references — selectors that fall back to "no entry yet" must
// return the SAME array on every read, otherwise React's
// useSyncExternalStore complains with "The result of getServerSnapshot
// should be cached to avoid an infinite loop".
export const EMPTY_SHAPES: ReadonlyArray<Shape> = Object.freeze([]);

interface ProjectDrawingState {
  tool: DrawTool;
  style: DrawStyle;
  shapes: Shape[];
  past: Shape[][];
  future: Shape[][];
}

const EMPTY_PROJECT_STATE: ProjectDrawingState = Object.freeze({
  // Pencil is the most natural "just start scribbling" tool, so we land
  // there when the user enters Draw mode for the first time. Once they
  // pick a different tool the choice sticks for the project (it lives in
  // byProject), matching how every other creative app remembers the last
  // used tool across sessions.
  tool: "pencil" as DrawTool,
  style: DEFAULT_DRAW_STYLE,
  shapes: [] as Shape[],
  past: [] as Shape[][],
  future: [] as Shape[][],
}) as unknown as ProjectDrawingState;

interface DrawingState {
  byProject: Record<string, ProjectDrawingState>;

  setTool: (projectId: string, tool: DrawTool) => void;
  setStyle: (projectId: string, patch: Partial<DrawStyle>) => void;
  commit: (projectId: string, shape: Shape) => void;
  /** Erase any shape whose hit region contains (x, y). */
  eraseAt: (
    projectId: string,
    hit: (shape: Shape) => boolean,
    /**
     * Begin a new history entry. Pass `true` on the first eraser pointerdown
     * of a stroke and `false` on subsequent pointermoves so the whole stroke
     * undoes as a single step.
     */
    startNewHistoryEntry: boolean,
  ) => void;
  undo: (projectId: string) => void;
  redo: (projectId: string) => void;
  clear: (projectId: string) => void;
}

function getProjectState(
  byProject: Record<string, ProjectDrawingState>,
  projectId: string,
): ProjectDrawingState {
  return byProject[projectId] ?? EMPTY_PROJECT_STATE;
}

const HISTORY_LIMIT = 100;

function pushHistory(past: Shape[][], snapshot: Shape[]): Shape[][] {
  const next = [...past, snapshot];
  // Keep history bounded so a long doodling session doesn't hold every
  // intermediate snapshot in memory forever.
  if (next.length > HISTORY_LIMIT) next.shift();
  return next;
}

export const useDrawingStore = create<DrawingState>()((set) => ({
  byProject: {},

  setTool: (projectId, tool) =>
    set((s) => {
      const prev = getProjectState(s.byProject, projectId);
      return {
        byProject: {
          ...s.byProject,
          [projectId]: { ...prev, tool },
        },
      };
    }),

  setStyle: (projectId, patch) =>
    set((s) => {
      const prev = getProjectState(s.byProject, projectId);
      return {
        byProject: {
          ...s.byProject,
          [projectId]: { ...prev, style: { ...prev.style, ...patch } },
        },
      };
    }),

  commit: (projectId, shape) =>
    set((s) => {
      const prev = getProjectState(s.byProject, projectId);
      return {
        byProject: {
          ...s.byProject,
          [projectId]: {
            ...prev,
            shapes: [...prev.shapes, shape],
            past: pushHistory(prev.past, prev.shapes),
            // Any new edit invalidates the redo stack — matches every other
            // text-editor / Photoshop-style undo model the user already knows.
            future: [],
          },
        },
      };
    }),

  eraseAt: (projectId, hit, startNewHistoryEntry) =>
    set((s) => {
      const prev = getProjectState(s.byProject, projectId);
      const next = prev.shapes.filter((shape) => !hit(shape));
      if (next.length === prev.shapes.length) return {};
      const past = startNewHistoryEntry
        ? pushHistory(prev.past, prev.shapes)
        : prev.past;
      return {
        byProject: {
          ...s.byProject,
          [projectId]: {
            ...prev,
            shapes: next,
            past,
            future: [],
          },
        },
      };
    }),

  undo: (projectId) =>
    set((s) => {
      const prev = getProjectState(s.byProject, projectId);
      if (prev.past.length === 0) return {};
      const past = prev.past.slice(0, -1);
      const lastSnapshot = prev.past[prev.past.length - 1];
      return {
        byProject: {
          ...s.byProject,
          [projectId]: {
            ...prev,
            shapes: lastSnapshot,
            past,
            future: [...prev.future, prev.shapes],
          },
        },
      };
    }),

  redo: (projectId) =>
    set((s) => {
      const prev = getProjectState(s.byProject, projectId);
      if (prev.future.length === 0) return {};
      const future = prev.future.slice(0, -1);
      const nextSnapshot = prev.future[prev.future.length - 1];
      return {
        byProject: {
          ...s.byProject,
          [projectId]: {
            ...prev,
            shapes: nextSnapshot,
            past: [...prev.past, prev.shapes],
            future,
          },
        },
      };
    }),

  clear: (projectId) =>
    set((s) => {
      const prev = getProjectState(s.byProject, projectId);
      if (prev.shapes.length === 0 && prev.past.length === 0) return {};
      return {
        byProject: {
          ...s.byProject,
          [projectId]: {
            ...prev,
            shapes: [],
            past: [],
            future: [],
          },
        },
      };
    }),
}));

/** Selector helpers — keep selector identity stable per project. */
export function selectTool(projectId: string) {
  return (s: DrawingState) => getProjectState(s.byProject, projectId).tool;
}
export function selectStyle(projectId: string) {
  return (s: DrawingState) => getProjectState(s.byProject, projectId).style;
}
export function selectShapes(projectId: string) {
  return (s: DrawingState) => getProjectState(s.byProject, projectId).shapes;
}
export function selectCanUndo(projectId: string) {
  return (s: DrawingState) =>
    getProjectState(s.byProject, projectId).past.length > 0;
}
export function selectCanRedo(projectId: string) {
  return (s: DrawingState) =>
    getProjectState(s.byProject, projectId).future.length > 0;
}
