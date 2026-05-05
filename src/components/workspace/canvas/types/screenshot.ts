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
  /**
   * When self-critique mode is active for the current session, the workspace
   * passes the active design id here so the hidden Sandpack can be pre-warmed
   * before the agent calls `screenshotDesign`. Set to `null` when self-critique
   * is off — the host will tear down immediately if no capture is in flight.
   */
  preWarmDesignId?: string | null;
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
  /**
   * Called when Sandpack's bundler fires its `"done"` event, meaning the
   * compiled bundle is live in the preview iframe and the screenshot script
   * has had a chance to install. The host uses this as the signal to attempt
   * the screenshot instead of relying on a blind timeout.
   */
  onReady?: () => void;
}
