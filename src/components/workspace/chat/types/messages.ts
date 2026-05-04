import type { UIMessage } from "ai";
import type { ApiKeySummary } from "@/lib/workspace/types";
import type { ChatError } from "@/components/workspace/chat/utils/chat-errors";

export interface ChatPaneProps {
  projectId: string;
  apiKeys: ApiKeySummary[];
  /**
   * True when the project already has at least one session on the server.
   * Used to distinguish "loading sessions" (show skeleton) from "genuinely
   * no sessions yet" (show the empty-state prompt).
   */
  hasSessions?: boolean;
}

export interface ActiveSessionLoaderProps {
  projectId: string;
  sessionId: string;
}

export interface ActiveSessionProps {
  projectId: string;
  sessionId: string;
  initialMessages: UIMessage[];
  active: boolean;
}

export interface MessageListProps {
  sessionId: string;
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  chatError?: ChatError | null;
}
