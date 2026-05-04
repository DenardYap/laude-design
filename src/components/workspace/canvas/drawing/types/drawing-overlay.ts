export interface DrawingOverlayProps {
  projectId: string;
  /** Container the SVG fills. The overlay sizes itself to its parent. */
  className?: string;
}

export interface Point {
  x: number;
  y: number;
}
