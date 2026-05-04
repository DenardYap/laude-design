import type { ReactNode, RefObject } from "react";

export interface DrawingShapeBarProps {
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

export interface ToolButtonProps {
  label: string;
  shortcut?: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}
