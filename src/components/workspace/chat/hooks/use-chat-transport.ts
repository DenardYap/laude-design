"use client";

import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useLatestRef } from "@/components/shared/hooks/use-latest-ref";
import { useActiveDesignId } from "@/components/workspace/chat/hooks/use-active-design";
import { resolveModelOption } from "@/lib/workspace/utils/models";
import { resolveSessionModel, useWorkspaceStore } from "@/stores/workspace-store";

interface UseChatTransportOptions {
  projectId: string;
  sessionId: string;
}

/**
 * Creates the DefaultChatTransport for a session, keeping the model,
 * active design, and self-critique values up-to-date via latest-refs
 * so the transport closure never reads stale values.
 */
export function useChatTransport({ projectId, sessionId }: UseChatTransportOptions) {
  const selectedModel = useWorkspaceStore((s) => resolveSessionModel(sessionId, projectId, s));
  const activeDesignId = useActiveDesignId(projectId);
  const selfCritique = useWorkspaceStore((s) => s.selfCritiqueBySession[sessionId] ?? false);

  const selectedModelRef = useLatestRef(selectedModel);
  const activeDesignIdRef = useLatestRef(activeDesignId);
  const selfCritiqueRef = useLatestRef(selfCritique);

  return useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/projects/${projectId}/chat`,
        prepareSendMessagesRequest: ({ messages, id, trigger, messageId, body }) => {
          const active = resolveModelOption(selectedModelRef.current);
          return {
            body: {
              ...body,
              id,
              messages,
              trigger,
              messageId,
              sessionId,
              modelId: active.modelId,
              provider: active.provider,
              activeDesignId: activeDesignIdRef.current,
              selfCritique: selfCritiqueRef.current,
            },
          };
        },
      }),
    // The transport only needs to be recreated if the project or session changes.
    // Model/design/selfCritique are intentionally read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, sessionId],
  );
}
