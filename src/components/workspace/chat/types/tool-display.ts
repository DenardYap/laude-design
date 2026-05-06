import type { LucideIcon } from "lucide-react";

export interface ToolDisplay {
  /** Present-progressive label shown while the tool is still running. */
  activeLabel: string;
  /** Past-tense label shown once the tool has finished (success or stop). */
  pastLabel: string;
  icon: LucideIcon;
}
