import type { RefObject } from "react";
import type { DesignDTO, DesignFileDTO } from "@/lib/workspace/types";

export interface DesignRendererProps {
  projectId: string;
  design: DesignDTO;
  /** Forwarded ref so the screenshot tool can capture this element. */
  captureRef: RefObject<HTMLDivElement | null>;
  /** Forwarded ref to the scrollable viewport — used by the Draw tool to
   * capture only what the user can currently see. */
  viewportRef: RefObject<HTMLDivElement | null>;
}

export interface DesignerInternalsProps {
  projectId: string;
  designFiles: DesignFileDTO[];
  onReady?: () => void;
  onFilesUpdating?: () => void;
}
