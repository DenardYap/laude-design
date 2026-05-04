"use client";

import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";

import { ActiveSession } from "@/components/workspace/chat/active-session";
import { ChatSessionSkeleton } from "@/components/workspace/chat/chat-session-skeleton";
import type { ActiveSessionLoaderProps } from "@/components/workspace/chat/types/messages";

export function ActiveSessionLoader({
  projectId,
  sessionId,
  active,
}: ActiveSessionLoaderProps) {
  const initial = useQuery({
    queryKey: ["session-messages", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = (await res.json()) as { messages: UIMessage[] };
      return data.messages;
    },
    staleTime: 30_000,
  });

  // While history loads we render a skeleton (only when active — inactive
  // tabs render nothing). The Composer lives at ChatPane level so it stays
  // visible during this window; only the message list is gated on the fetch.
  if (initial.isPending) {
    return active ? <ChatSessionSkeleton /> : null;
  }

  return (
    <ActiveSession
      projectId={projectId}
      sessionId={sessionId}
      initialMessages={initial.data ?? []}
      active={active}
    />
  );
}
