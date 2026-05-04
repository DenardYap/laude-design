import type { ExitDrawingControl } from "@/components/workspace/canvas/drawing/hooks/use-exit-drawing";

export interface CanvasToolbarProps {
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
