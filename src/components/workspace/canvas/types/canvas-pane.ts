import type { RefObject } from "react";
import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import type { ExitDrawingControl } from "@/components/workspace/canvas/drawing/hooks/use-exit-drawing";

export interface CanvasHeaderProps {
  projectId: string;
  designs: DesignDTO[];
  onCaptureFull: () => void;
  onStartAreaCapture: () => void;
  onRequestSwitch: ExitDrawingControl["requestSwitch"];
}

export interface CanvasPaneProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
  captureRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
}
