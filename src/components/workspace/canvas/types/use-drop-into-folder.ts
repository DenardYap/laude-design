import type { DesignDTO, FolderDTO } from "@/lib/workspace/types";

export interface UseDropIntoFolderOptions {
  /** The folder to move items into, or `null` for the project root. */
  targetFolderId: string | null;
  targetFolderName?: string | null;
  folders: FolderDTO[];
  designs: DesignDTO[];
}
