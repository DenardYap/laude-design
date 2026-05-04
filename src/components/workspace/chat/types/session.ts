import type { MouseEvent } from 'react';
import type { ChatSessionDTO } from "@/lib/workspace/types";

export interface SessionTabsProps {
  projectId: string;
  sessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
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

export interface SessionHistoryListProps {
  sessions: ChatSessionDTO[];
  activeSessionId: string | undefined;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export interface RecencyGroup {
  /** Stable key used to render and to disambiguate cmdk values across groups. */
  label: string;
  sessions: ChatSessionDTO[];
}
