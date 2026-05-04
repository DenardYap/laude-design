import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";
import type { CaptureStatus } from "@/components/workspace/export/hooks/use-design-screenshot-capture";

export type ExportMode = "image" | "prompt";

export interface ExportToAgentDialogProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
}

export interface ActiveExportProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  design: DesignDTO;
  designs: DesignDTO[];
  mode: ExportMode;
  onModeChange: (m: ExportMode) => void;
  onPickDesign: (id: string) => void;
}

export interface ProjectZipButtonProps {
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
}

export type PendingAction = "copy" | "png" | "pdf";

export interface ImageExportTabProps {
  design: DesignDTO;
  status: CaptureStatus;
  onRetry: () => void;
  captureAsync: () => Promise<string>;
}

export interface ThumbnailPreviewProps {
  status: CaptureStatus;
  designName: string;
  onRetry: () => void;
}

export interface PromptExportTabProps {
  design: DesignDTO;
}
