import type { WheelEvent } from "react";

export interface ImageViewportProps {
  url: string;
  name: string;
  zoom: number;
  naturalHeight: number | null;
  onNaturalHeightLoad: (height: number) => void;
  onWheel: (e: WheelEvent<HTMLDivElement>) => void;
}

export interface ZoomToolbarProps {
  zoom: number;
  onZoomChange: (z: number) => void;
}
