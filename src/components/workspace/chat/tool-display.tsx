import {
  CheckCircle2,
  FilePlus,
  FileText,
  FolderOpen,
  HelpCircle,
  ListChecks,
  PencilLine,
  Tag,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface ToolDisplay {
  /** Present-progressive label shown while the tool is still running. */
  activeLabel: string;
  /** Past-tense label shown once the tool has finished (success or stop). */
  pastLabel: string;
  icon: LucideIcon;
}

const TOOL_DISPLAY: Record<string, ToolDisplay> = {
  createDesign: {
    activeLabel: "Creating design",
    pastLabel: "Created design",
    icon: FilePlus,
  },
  listDesigns: {
    activeLabel: "Listing designs",
    pastLabel: "Listed designs",
    icon: FolderOpen,
  },
  readDesign: {
    activeLabel: "Reading design",
    pastLabel: "Read design",
    icon: FileText,
  },
  editDesign: {
    activeLabel: "Editing design",
    pastLabel: "Edited design",
    icon: PencilLine,
  },
  deleteDesign: {
    activeLabel: "Deleting design",
    pastLabel: "Deleted design",
    icon: Trash2,
  },
  renameDesign: {
    activeLabel: "Renaming design",
    pastLabel: "Renamed design",
    icon: Tag,
  },
  askClarifyingQuestions: {
    activeLabel: "Asking clarifying questions",
    pastLabel: "Asked clarifying questions",
    icon: HelpCircle,
  },
  planDesign: {
    activeLabel: "Planning design",
    pastLabel: "Planned design",
    icon: ListChecks,
  },
  completePlanStep: {
    activeLabel: "Completing step",
    pastLabel: "Completed step",
    icon: CheckCircle2,
  },
};

const FALLBACK: ToolDisplay = {
  activeLabel: "Running tool",
  pastLabel: "Ran tool",
  icon: Wrench,
};

export function getToolDisplay(toolName: string): ToolDisplay {
  return TOOL_DISPLAY[toolName] ?? FALLBACK;
}
