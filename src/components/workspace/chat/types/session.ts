import type { MouseEvent } from "react";
import type { ChatSessionDTO } from "@/lib/workspace/types";

export interface SessionTabsProps {
  projectId: string;
  sessions: ChatSessionDTO[];
}

export interface SessionTabProps {
  session: ChatSessionDTO;
  projectId: string;
  active: boolean;
  onSelect: () => void;
  isPending: boolean;
  isDragging?: boolean;
  dragOffset?: number;
  tabRef?: (el: HTMLDivElement | null) => void;
  onMouseDown?: (e: MouseEvent<HTMLDivElement>) => void;
}

// ---------------------------------------------------------------------------
// SessionHistoryList
// ---------------------------------------------------------------------------

export interface SessionHistoryListProps {
  projectId: string;
  sessions: ChatSessionDTO[];
}

export interface SessionHistoryRowProps {
  session: ChatSessionDTO;
  projectId: string;
  isActive: boolean;
}

export interface RecencyGroup {
  /** Stable key used to render and to disambiguate cmdk values across groups. */
  label: string;
  sessions: ChatSessionDTO[];
}

// ---------------------------------------------------------------------------
// SessionTabStrip — owns scroll/drag; reads everything else from the store
// ---------------------------------------------------------------------------

export interface SessionTabStripProps {
  projectId: string;
  sessionsById: ReadonlyMap<string, ChatSessionDTO>;
}

// ---------------------------------------------------------------------------
// SessionTabActions — owns historyOpen state; reads store for active + open
// ---------------------------------------------------------------------------

export interface SessionTabActionsProps {
  projectId: string;
  sessions: ChatSessionDTO[];
  onNew: () => void;
}
