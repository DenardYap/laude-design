import type { MouseEvent as ReactMouseEvent } from "react";
import type { DesignDTO } from "@/lib/workspace/types";

export interface CanvasTabStripProps {
  projectId: string;
  designs: DesignDTO[];
}

export interface DesignTabProps {
  design: DesignDTO;
  active: boolean;
  renaming: boolean;
  onRenameChange: (renaming: boolean) => void;
  isDragging: boolean;
  dragOffset: number;
  tabRef: (el: HTMLDivElement | null) => void;
  onSelect: () => void;
  onClose: () => void;
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => void;
}
