import type { MouseEvent, RefObject } from "react";
import type { ChatSessionDTO } from "@/lib/workspace/types";

export interface SessionTabsProps {
  projectId: string;
  sessions: ChatSessionDTO[];
}

export interface SessionTabProps {
  session: ChatSessionDTO;
  active: boolean;
  onSelect: () => void;
  isPending: boolean;
  onClose: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragOffset?: number;
  tabRef?: (el: HTMLDivElement | null) => void;
  onMouseDown?: (e: MouseEvent<HTMLDivElement>) => void;
}

// ---------------------------------------------------------------------------
// SessionHistoryList
// ---------------------------------------------------------------------------

export interface SessionHistoryListProps {
  sessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export interface SessionHistoryRowProps {
  session: ChatSessionDTO;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export interface RecencyGroup {
  /** Stable key used to render and to disambiguate cmdk values across groups. */
  label: string;
  sessions: ChatSessionDTO[];
}

// ---------------------------------------------------------------------------
// SessionTabStrip — reads projectId to get activeSessionId from store
// ---------------------------------------------------------------------------

export interface SessionTabStripProps {
  projectId: string;
  displaySessions: ChatSessionDTO[];
  dragOffset: { tabId: string; offset: number } | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  maskImage: string;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
  registerTabEl: (id: string) => (el: HTMLDivElement | null) => void;
  onTabMouseDown: (id: string, e: MouseEvent<HTMLDivElement>) => void;
}

// ---------------------------------------------------------------------------
// SessionTabActions — owns historyOpen state; reads store for active + open
// ---------------------------------------------------------------------------

export interface SessionTabActionsProps {
  projectId: string;
  sessions: ChatSessionDTO[];
  onNew: () => void;
  onDeleteFromHistory: (id: string) => void;
}
