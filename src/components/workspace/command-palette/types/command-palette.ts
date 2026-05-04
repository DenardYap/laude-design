import type { DesignDTO } from "@/lib/workspace/types";

export interface CommandPaletteProps {
  currentProjectId: string;
  projects: { id: string; name: string }[];
  designs: DesignDTO[];
}
