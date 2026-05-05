import type React from "react";

export interface ImageViewportProps {
  url: string;
  name: string;
  zoom: number;
  naturalHeight: number | null;
  onNaturalHeightLoad: (height: number) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

export interface ZoomToolbarProps {
  zoom: number;
  onZoomChange: (z: number) => void;
}
