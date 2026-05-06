import {
  Camera,
  CheckCircle2,
  FilePlus,
  FileText,
  FolderOpen,
  FolderInput,
  FolderPlus,
  FolderTree,
  HelpCircle,
  ListChecks,
  PencilLine,
  Search,
  Tag,
  Trash2,
  Wrench,
} from "lucide-react";
import type { ToolDisplay } from "@/components/workspace/chat/types/tool-display";

export type { ToolDisplay };

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
  readDesignOutline: {
    activeLabel: "Reading design outline",
    pastLabel: "Read design outline",
    icon: FileText,
  },
  grepDesign: {
    activeLabel: "Referencing existing design",
    pastLabel: "Referenced existing design",
    icon: Search,
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
  listFolders: {
    activeLabel: "Listing folders",
    pastLabel: "Listed folders",
    icon: FolderTree,
  },
  createFolder: {
    activeLabel: "Creating folder",
    pastLabel: "Created folder",
    icon: FolderPlus,
  },
  moveDesign: {
    activeLabel: "Moving design",
    pastLabel: "Moved design",
    icon: FolderInput,
  },
  moveFolder: {
    activeLabel: "Moving folder",
    pastLabel: "Moved folder",
    icon: FolderInput,
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
  screenshotDesign: {
    activeLabel: "Reviewing the design",
    pastLabel: "Reviewed the design",
    icon: Camera,
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
