import type { UIMessage } from "ai";
import type { ChatError } from "@/components/workspace/chat/utils/chat-errors";

export interface ConfigureKeysLinkProps {
  label?: string;
}

export interface ScrollToBottomButtonProps {
  onClick: () => void;
}

export interface CopyMessageButtonProps {
  text: string;
}

export interface MessageRowProps {
  message: UIMessage;
  isStreaming: boolean;
  sessionId: string;
}

export interface ChatErrorBannerProps {
  error: ChatError;
}

export interface ChatPaneProps {
  projectId: string;
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
