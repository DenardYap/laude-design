export type Phase = "loading" | "fading" | "hidden";

export interface CanvasLoadingOverlayProps {
  /**
   * Set to true once the canvas is compiled and ready to show. When this
   * flips to true the overlay begins its two-phase fade out. When the
   * component remounts (via a key change) it always starts in the "loading"
   * phase regardless of this prop.
   */
  ready?: boolean;
}
