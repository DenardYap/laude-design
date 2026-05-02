import { NextResponse } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MissingApiKeyError, resolveModel } from "@/lib/ai/providers";
import { buildDesignTools } from "@/lib/ai/tools";
import { DESIGN_SYSTEM_PROMPT, formatActiveSkills } from "@/lib/ai/system-prompt";
import { generateSessionTitle } from "@/lib/ai/title-generator";
import { applyRollingSummary } from "@/lib/ai/context-summarizer";
import { inlineAttachmentDataUrls } from "@/lib/ai/inline-attachments";
import { resolveInternalModel } from "@/lib/ai/internal-models";
import { calculateCost, getModelPricing } from "@/lib/ai/pricing";
import { getContextWindow } from "@/lib/workspace/types";
import {
  encodeChatError,
  parseChatError,
} from "@/components/workspace/chat/chat-errors";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  id: string;
  messages: UIMessage[];
  trigger: "submit-message" | "regenerate-message";
  messageId?: string;
  sessionId: string;
  modelId: string;
  provider: "CLAUDE" | "OPENAI" | "GEMINI";
  activeDesignId: string | null;
}

const DEFAULT_SESSION_TITLE = "New Session";

// Custom data part shape streamed back to the client when we auto-name a
// session. Keep this in sync with the consumer in `chat-pane.tsx`.
export interface SessionTitleDataPart {
  sessionId: string;
  title: string;
}

// Custom data part broadcast after each turn finishes so the client can update
// the chatbox usage indicator without waiting for a refetch. Mirrors the
// columns persisted on `ChatSession` (already incremented in DB by the time
// this is written). Consumed in `chat-pane.tsx`.
export interface SessionUsageDataPart {
  sessionId: string;
  cumulativeInputTokens: number;
  cumulativeOutputTokens: number;
  summarizedCount: number;
  totalCostUsd: number;
}

function extractText(parts: UIMessage["parts"]): string {
  return parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n")
    .trim();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id: projectId } = await params;
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = (await req.json()) as Body;
  const {
    messages,
    sessionId,
    modelId,
    provider,
    activeDesignId,
    trigger,
    messageId,
  } = body;

  const chatSession = await db.chatSession.findFirst({
    where: { id: sessionId, projectId },
    select: { id: true, title: true, rollingSummary: true },
  });
  if (!chatSession) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Fetch every skill owned by this user that is effectively applied for this
  // project. "Effective" = coalesce(override.applied, skill.appliedByDefault).
  const activeSkills = await db.skill.findMany({
    where: {
      userId,
      OR: [
        // No override row → fall back to appliedByDefault
        {
          appliedByDefault: true,
          overrides: { none: { projectId } },
        },
        // Override row exists and is explicitly on
        {
          overrides: { some: { projectId, applied: true } },
        },
      ],
    },
    select: { name: true, description: true, content: true },
    orderBy: { updatedAt: "asc" },
  });

  let model;
  try {
    model = await resolveModel(userId, provider, modelId);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          error: encodeChatError({
            type: "api-key-missing",
            provider: err.provider,
          }),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const lastUserMessage =
    trigger === "submit-message" && messages[messages.length - 1]?.role === "user"
      ? messages[messages.length - 1]
      : null;

  if (lastUserMessage) {
    await db.message.create({
      data: {
        sessionId,
        role: "user",
        parts: lastUserMessage.parts as object,
      },
    });
  } else if (trigger === "regenerate-message" && messageId) {
    await db.message.deleteMany({ where: { id: messageId, sessionId } });
  }

  // Decide up-front whether this turn should attempt auto-naming. Captured
  // here so a concurrent rename doesn't make us miss the trigger.
  const shouldAutoName =
    chatSession.title === DEFAULT_SESSION_TITLE && lastUserMessage !== null;

  const tools = buildDesignTools({ projectId, userId, activeDesignId, sessionId });
  // Anthropic/OpenAI/Gemini all need the actual file bytes, not relative URLs
  // that only resolve in the browser. Inline `/uploads/*` files as data URLs
  // here — we keep the compact URL form in the persisted message history.
  const inlinedMessages = await inlineAttachmentDataUrls(messages);
  const modelMessages = await convertToModelMessages(inlinedMessages);

  // Rolling-summary policy: if the conversation has grown past the trigger
  // ratio of the model's context window, fold the oldest messages into a
  // ~1000-char summary so the live window stays bounded. Persisted on the
  // session so it carries across turns.
  const summarizer = await resolveInternalModel(userId);
  const rolling = await applyRollingSummary({
    messages: modelMessages,
    previousSummary: chatSession.rollingSummary,
    contextWindow: getContextWindow(provider, modelId),
    summarizerModel: summarizer?.model ?? null,
  });
  if (rolling.summarized) {
    await db.chatSession.update({
      where: { id: sessionId },
      data: { rollingSummary: rolling.summary },
    });
  }

  const skillsBlock = formatActiveSkills(activeSkills);
  const summaryBlock = rolling.summary
    ? `\n\n## Earlier conversation summary\n${rolling.summary}`
    : "";
  const systemPrompt = `${DESIGN_SYSTEM_PROMPT}${skillsBlock}${summaryBlock}`;

  const result = streamText({
    model,
    system: systemPrompt,
    messages: rolling.messages,
    tools,
    stopWhen: stepCountIs(24),
    // Propagate the client's abort (Stop button -> useChat.stop()) all the way
    // down to the model call so we stop billing tokens immediately instead of
    // letting the model finish generating after the user has already cancelled.
    abortSignal: req.signal,
    onError: (err) => {
      console.error("[chat]", err);
    },
  });

  // Translate any error that flows out of the model stream into a tagged
  // payload our client can render as a friendly banner.
  const errorMessageForClient = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] stream error", message);
    const classified = parseChatError(message);
    const enriched =
      classified.type === "generic"
        ? { ...classified, message: `[${provider}] ${classified.message}` }
        : classified;
    return encodeChatError(enriched);
  };

  const stream = createUIMessageStream<UIMessage>({
    onError: errorMessageForClient,
    execute: async ({ writer }) => {
      writer.merge(result.toUIMessageStream({ onError: errorMessageForClient }));

      // Wait for the stream to finish so we can pull the final token usage.
      // `result.usage` resolves even on abort with whatever the provider
      // billed for the partial generation — keeping that increment is the
      // right call (the user paid for those tokens).
      let usage: { inputTokens?: number; outputTokens?: number } | null = null;
      try {
        const u = await result.usage;
        usage = { inputTokens: u?.inputTokens, outputTokens: u?.outputTokens };
      } catch {
        usage = null;
      }

      const pricing = getModelPricing(provider, modelId);
      const cost = usage && pricing ? calculateCost(usage, pricing) : 0;
      const inputDelta = usage?.inputTokens ?? 0;
      const outputDelta = usage?.outputTokens ?? 0;
      const summarizedDelta = rolling.summarized ? 1 : 0;

      // Skip the DB round-trip when nothing changed (e.g. provider crashed
      // before emitting any tokens AND no summarization happened this turn).
      if (inputDelta > 0 || outputDelta > 0 || cost > 0 || summarizedDelta > 0) {
        try {
          const updated = await db.chatSession.update({
            where: { id: sessionId },
            data: {
              cumulativeInputTokens: { increment: inputDelta },
              cumulativeOutputTokens: { increment: outputDelta },
              totalCostUsd: { increment: cost },
              ...(summarizedDelta > 0
                ? { summarizedCount: { increment: summarizedDelta } }
                : {}),
            },
            select: {
              cumulativeInputTokens: true,
              cumulativeOutputTokens: true,
              summarizedCount: true,
              totalCostUsd: true,
            },
          });

          writer.write({
            type: "data-session-usage",
            data: {
              sessionId,
              cumulativeInputTokens: updated.cumulativeInputTokens,
              cumulativeOutputTokens: updated.cumulativeOutputTokens,
              summarizedCount: updated.summarizedCount,
              totalCostUsd: updated.totalCostUsd,
            } satisfies SessionUsageDataPart,
            transient: true,
          });
        } catch (err) {
          console.error("[chat] usage persist failed", err);
        }
      }

      if (!shouldAutoName) return;

      // Title the session from the first reply. `await result.text` is
      // already resolved at this point (we awaited `result.usage` above), so
      // this is effectively a no-op wait.
      let assistantText = "";
      try {
        assistantText = await result.text;
      } catch {
        return;
      }

      const userText = extractText(lastUserMessage!.parts);
      if (!userText) return;

      const title = await generateSessionTitle({
        userId,
        firstUserMessage: userText,
        firstAssistantMessage: assistantText,
      });
      if (!title) return;

      // Atomic update — only flips the title when it's still the default, so
      // a manual rename mid-flight always wins.
      const updated = await db.chatSession.updateMany({
        where: { id: sessionId, title: DEFAULT_SESSION_TITLE },
        data: { title },
      });
      if (updated.count === 0) return;

      writer.write({
        type: "data-session-title",
        data: { sessionId, title } satisfies SessionTitleDataPart,
        transient: true,
      });
    },
    onFinish: async ({ responseMessage }) => {
      if (responseMessage.role === "assistant") {
        await db.message.create({
          data: {
            sessionId,
            role: "assistant",
            parts: responseMessage.parts as object,
          },
        });
      }
      await db.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() },
      });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    // Tee a copy of the SSE stream into a no-op sink so server-side consumption
    // continues even if the client disconnects (e.g. user clicked Stop). This
    // guarantees `onFinish` above runs and the partial assistant message gets
    // persisted, so reloading the session shows what the model generated up to
    // the cancellation point instead of an empty turn.
    consumeSseStream: ({ stream }) =>
      stream.pipeTo(new WritableStream()).catch(() => {}),
  });
}
