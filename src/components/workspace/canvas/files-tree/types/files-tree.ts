import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";

export interface FilesTreeProps {
  projectId: string;
  projectName: string;
  folders: FolderDTO[];
  designs: DesignDTO[];
}

export interface ProjectRootRowProps {
  name: string;
  expanded: boolean;
  onToggle: () => void;
  dropTarget?: boolean;
}

export interface DesignRowProps {
  projectId: string;
  design: DesignDTO;
  folders: FolderDTO[];
  designs: DesignDTO[];
  depth: number;
}

export interface FolderRowProps {
  projectId: string;
  folder: FolderDTO;
  folders: FolderDTO[];
  designs: DesignDTO[];
  depth: number;
}

export interface FolderChildrenProps {
  projectId: string;
  parentId: string | null;
  folders: FolderDTO[];
  designs: DesignDTO[];
  depth: number;
}

export interface DescendantCounts {
  designCount: number;
  folderCount: number;
}
