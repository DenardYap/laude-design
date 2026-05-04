import type { RefObject } from "react";
import type { DesignDTO } from "@/lib/workspace/types";
import type { ScreenshotRect } from "@/components/workspace/canvas/hooks/use-screenshot";

export type { ScreenshotRect };

export interface Point {
  x: number;
  y: number;
}

export interface ScreenshotAreaOverlayProps {
  /** Element being captured. The overlay renders on top of its bounding box. */
  captureRef: RefObject<HTMLDivElement | null>;
  /** Called with the user's selection in parent-page viewport CSS coords. */
  onCapture: (rect: ScreenshotRect) => void;
}

export interface ScreenshotHostProps {
  projectId: string;
  designs: DesignDTO[];
}

export interface ScreenshotSandpackProps {
  /**
   * The design to render. Changing the design's `id` triggers a remount
   * via `key={design.id}` in the parent host so the bundler starts fresh
   * with the new file set; same-id updates flow through `updateFile` in
   * the `<FileMirror/>` child without restarting Sandpack.
   */
  design: DesignDTO;
  /**
   * Forwarded ref so the host can DOM-query the live iframe element.
   */
  hostRef: RefObject<HTMLDivElement | null>;
}
