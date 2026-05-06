import { NextResponse } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

// SECURITY: Never log the decrypted API key anywhere in this file. Errors
// are sanitized by `sanitizeErrorMessage` before they reach the client to
// prevent leaking key material from provider stack traces.
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { limitByUser } from "@/lib/ratelimit";
import { MissingApiKeyError, resolveModel } from "@/lib/ai/providers";
import { buildDesignTools } from "@/lib/ai/tools";
import {
  DESIGN_SYSTEM_PROMPT,
  SELF_CRITIQUE_ADDENDUM,
  formatActiveSkills,
} from "@/lib/ai/system-prompt";
import { generateSessionTitle } from "@/lib/ai/title-generator";
import { applyRollingSummary } from "@/lib/ai/context-summarizer";
import {
  buildCacheableSystemPrompt,
  withCachedToolPrefix,
} from "@/lib/ai/prompt-caching";
import { inlineAttachmentDataUrls } from "@/lib/ai/inline-attachments";
import { resolveInternalModel } from "@/lib/ai/internal-models";
import { calculateCost, getModelPricing } from "@/lib/ai/pricing";
import { getContextWindow } from "@/lib/workspace/utils/models";
import { sanitizeModelMessages } from "@/lib/ai/sanitize-messages";
import {
  encodeChatError,
  parseChatError,
} from "@/components/workspace/chat/utils/chat-errors";

// Redacts any API key material that might appear in provider error messages.
const API_KEY_PATTERN =
  /sk-ant-[a-zA-Z0-9_-]+|sk-[a-zA-Z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}/g;

function sanitizeErrorMessage(message: string): string {
  return message.replace(API_KEY_PATTERN, "[REDACTED]");
}

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
  // The user's API key is loaded from the encrypted database row keyed by
  // (userId, provider) — it never travels in the request body or headers.
  // Optional — older clients may omit it; treat undefined as off.
  selfCritique?: boolean;
}

const DEFAULT_SESSION_TITLE = "New Session";

// Custom data part shape streamed back to the client when we auto-name a
// session. Keep this in sync with the consumer in `chat-pane.tsx`.
export interface SessionTitleDataPart {
  sessionId: string;
  title: string;
}

// Custom data part broadcast after each step inside a turn so the client can
// update the chatbox usage indicator without waiting for a refetch. Mirrors
// the `SessionUsage` shape. Consumed in `chat-pane.tsx`.
export interface SessionUsageDataPart {
  sessionId: string;
  currentInputTokens: number;
  lifetimeFoldedTokens: number;
  lifetimeOutputTokens: number;
  summarizedCount: number;
  totalCostUsd: number;
  // True when rolling summarization fired this turn. Lets the client inject
  // an in-chat "context was summarized" marker without a separate event type.
  justSummarized: boolean;
}

function extractText(parts: UIMessage["parts"]): string {
  return parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n")
    .trim();
}

/**
 * Remove `screenshotDesign` tool-call parts from PRIOR-TURN assistant
 * messages before the history is sent to the model. Past screenshots are
 * ephemeral self-critique artifacts — the model incorporated its
 * observations as plain text in the same turn, so no future turn benefits
 * from replaying them. Stripping them:
 *   1. Prevents AI_MissingToolResultsError when a prior call was saved with
 *      `output-error` state (no `output` field → SDK sees a "missing result")
 *   2. Avoids `toModelOutput` trying to re-read a stale upload file
 *   3. Keeps the context window smaller (screenshots expand to large base64)
 *
 * Critically, screenshots inside the CURRENT in-flight turn (after the last
 * user message) must be preserved. `screenshotDesign` is client-fulfilled,
 * which means the AI SDK auto-continues with a new request once the client
 * posts the tool result back. If we stripped the just-completed screenshot
 * from that continuation request, the model would see its own previous
 * narration ("Let me take a screenshot…") with no corresponding tool call
 * in context, lose memory of what it just did, and re-emit the entire
 * preceding sequence (re-running listDesigns, re-saying the same intro
 * text, taking another screenshot) — which is exactly the duplicate-output
 * bug self-critique mode used to exhibit.
 */
function stripScreenshotParts(messages: UIMessage[]): UIMessage[] {
  // Find the last user message — anything after it belongs to the
  // in-flight turn and is off-limits to the stripper.
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  return messages.map((m, i) => {
    if (m.role !== "assistant") return m;
    if (i > lastUserIdx) return m;
    const filtered = m.parts.filter(
      (p) => (p as { type?: string }).type !== "tool-screenshotDesign",
    );
    if (filtered.length === m.parts.length) return m;
    return { ...m, parts: filtered };
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Per-user limiter on the streaming chat path. The middleware already
  // applied a coarse per-IP cap; this one is keyed on the authenticated
  // user so abuse costs the abusing account's own quota and never starves
  // another user — even if multiple users share an egress IP (NAT, school
  // network) or the IP-detection layer ever regresses.
  const userLimit = await limitByUser(userId);
  if (!userLimit.success) {
    return NextResponse.json(
      { error: "You're sending chat requests too fast. Please wait a moment." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": userLimit.limit.toString(),
          "X-RateLimit-Remaining": userLimit.remaining.toString(),
          "X-RateLimit-Reset": userLimit.reset.toString(),
        },
      },
    );
  }

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
  const selfCritique = body.selfCritique === true;

  // Load the encrypted API key for this (user, provider) pair and decrypt
  // it in memory only for the lifetime of this request. The plaintext is
  // never returned to the client, never logged, and never persisted in
  // any non-ciphertext form. A missing row produces the same friendly
  // banner the legacy "header missing" path used to surface.
  //
  // The WHERE clause lets the DB be the authority on expiry time — it
  // filters out any row whose expiresAt has passed using the DB clock,
  // which avoids any app/DB clock-drift window.
  const now = new Date();
  const apiKeyRow = await db.apiKey.findFirst({
    where: {
      userId,
      provider,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { ciphertext: true },
  });

  // Lazy-expire: clean up any row that just aged out so the next GET /api-keys
  // response and the UI are both kept consistent without a separate cron job.
  await db.apiKey.deleteMany({
    where: { userId, provider, expiresAt: { lte: now } },
  });

  if (!apiKeyRow) {
    return NextResponse.json(
      {
        error: encodeChatError({
          type: "api-key-missing",
          provider,
        }),
      },
      { status: 400 },
    );
  }
  let apiKey: string;
  try {
    apiKey = decryptSecret(apiKeyRow.ciphertext);
  } catch (err) {
    console.error("[chat] failed to decrypt API key", err);
    return NextResponse.json(
      {
        error: encodeChatError({
          type: "api-key-missing",
          provider,
        }),
      },
      { status: 500 },
    );
  }

  const chatSession = await db.chatSession.findFirst({
    where: { id: sessionId, projectId },
    select: {
      id: true,
      title: true,
      rollingSummary: true,
      lastInputTokens: true,
      foldedMessageCount: true,
    },
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
    model = resolveModel(provider, modelId, apiKey);
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
    // Use the SDK-assigned UIMessage id as the DB id so it survives the
    // round-trip cleanly: subsequent turns (and `regenerate`, which
    // identifies the message to delete by id) all reference messages by
    // the same id the client holds in `useChat` state.
    await db.message.create({
      data: {
        id: lastUserMessage.id,
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

  // Tools are cache-anchored for Anthropic via providerOptions on the last
  // tool entry — the marker is harmless to OpenAI/Gemini (they auto-cache
  // and ignore Anthropic-namespaced metadata). See `prompt-caching.ts`.
  const tools = withCachedToolPrefix(
    buildDesignTools({
      projectId,
      userId,
      activeDesignId,
      sessionId,
      selfCritique,
    }),
  );
  // The chat UI deliberately keeps showing every user/assistant message
  // forever — the user wants to see their own scrollback regardless of
  // server-side context optimisations — so the client's `useChat` state
  // contains the FULL session history and re-sends all of it on every
  // turn. Drop the prefix that's already been folded into `rollingSummary`
  // before any token-counting / conversion happens. Without this slice,
  // every turn after the first summarization would re-blast the entire
  // history at the LLM PLUS tack the summary on top, immediately undoing
  // the summarizer's work and ping-ponging the live request between
  // ~18k (just-summarized) and ~44k (full history again) on alternate
  // turns. The clamp keeps at least the latest message even in the
  // pathological case where `foldedMessageCount` is somehow stale and
  // would otherwise drop the brand-new user turn.
  const safeFoldCount = Math.max(
    0,
    Math.min(chatSession.foldedMessageCount, messages.length - 1),
  );
  const liveUIMessages = messages.slice(safeFoldCount);

  // Anthropic/OpenAI/Gemini all need the actual file bytes, not relative URLs
  // that only resolve in the browser. Inline `/uploads/*` files as data URLs
  // here — we keep the compact URL form in the persisted message history.
  //
  // Strip prior-turn `screenshotDesign` parts BEFORE inlining or converting
  // (the in-flight turn's screenshot is preserved — see `stripScreenshotParts`
  // for the carve-out and why it's necessary). Past screenshots are
  // ephemeral self-critique snapshots: the model already folded its critique
  // into the same-turn text response, so future turns gain nothing from
  // having them in context. Leaving them in causes
  // `AI_MissingToolResultsError` when a previous call had `output-error`
  // state (the SDK treats it as a missing tool result), and would attempt to
  // re-read upload files that may no longer be on disk via `toModelOutput`.
  const messagesWithoutScreenshots = stripScreenshotParts(liveUIMessages);
  const inlinedMessages = await inlineAttachmentDataUrls(messagesWithoutScreenshots, userId);
  // Pass `tools` so AI SDK applies each tool's `toModelOutput` when folding
  // tool result parts into the model prompt. This is what makes
  // `screenshotDesign` actually deliver an *image* to the model — without
  // it, the LLM only sees the JSON URL the client posted back.
  const modelMessages = await convertToModelMessages(inlinedMessages, {
    tools,
  });

  const skillsBlock = formatActiveSkills(activeSkills);
  const critiqueBlock = selfCritique ? SELF_CRITIQUE_ADDENDUM : "";

  // Rolling-summary policy: if the conversation has grown past the trigger
  // ratio of the model's context window, fold the oldest messages into a
  // ~1000-char summary so the live window stays bounded. Persisted on the
  // session so it carries across turns.
  //
  // We pass the system-prompt overhead (static prompt + skills + critique,
  // minus the summary block which doesn't exist yet) so the trigger check
  // reflects the full prompt size that the provider will actually bill for,
  // not just the conversation messages. A fixed constant covers the tool
  // schemas the AI SDK serialises and sends alongside every request.
  // Empirically measured: 15 tools × ~1k tokens each ≈ 14,800 tokens.
  // Verified from a fresh "hi" session: 18k input − 3.2k system − ~1 message = ~14.8k tools.
  const TOOL_SCHEMA_OVERHEAD_TOKENS = 15_000;
  const systemPromptOverheadTokens =
    Math.ceil(
      (DESIGN_SYSTEM_PROMPT.length + skillsBlock.length + critiqueBlock.length) /
        4,
    ) + TOOL_SCHEMA_OVERHEAD_TOKENS;

  const summarizer = resolveInternalModel({
    activeProvider: provider,
    activeApiKey: apiKey,
  });
  const rolling = await applyRollingSummary({
    messages: modelMessages,
    previousSummary: chatSession.rollingSummary,
    contextWindow: getContextWindow(provider, modelId),
    summarizerModel: summarizer?.model ?? null,
    lastKnownTokens: chatSession.lastInputTokens,
    overheadTokens: systemPromptOverheadTokens,
  });
  if (rolling.summarized) {
    // The summarizer cut at ModelMessage index `foldedCount` — always on a
    // user-message boundary. Translate that back to a UIMessage cutoff so
    // we know how many entries to skip from the client's history on the
    // NEXT turn. User UIMessages map 1:1 to user ModelMessages
    // (assistant UIMessages with tool calls are the only ones that fan
    // out into multiple ModelMessages), so counting the user messages in
    // the folded ModelMessage prefix tells us exactly which user
    // UIMessage starts the new tail.
    let userMsgsFolded = 0;
    for (let i = 0; i < rolling.foldedCount; i++) {
      if (modelMessages[i].role === "user") userMsgsFolded++;
    }
    let userIdx = 0;
    let uiCutoffWithinSlice = liveUIMessages.length;
    for (let i = 0; i < liveUIMessages.length; i++) {
      if (liveUIMessages[i].role !== "user") continue;
      if (userIdx === userMsgsFolded) {
        uiCutoffWithinSlice = i;
        break;
      }
      userIdx++;
    }
    const newFoldedMessageCount =
      chatSession.foldedMessageCount + uiCutoffWithinSlice;

    await db.chatSession.update({
      where: { id: sessionId },
      data: {
        rollingSummary: rolling.summary,
        // Stash the size of the messages we just removed from the live
        // window. Combined with `lastInputTokens` on the client side via
        // `getLifetimeInputTokens`, this keeps the popover's "Input tokens"
        // line monotonic instead of dropping when the prompt shrinks.
        cumulativeFoldedTokens: { increment: rolling.foldedTokens },
        // Persist the new fold cutoff so subsequent turns slice this many
        // entries off the client's full-history payload BEFORE it ever
        // reaches the LLM. This is the half of the fix that makes
        // summarization actually durable across turns — without it the
        // client would happily re-blast the folded prefix on the very
        // next "hi" and the live prompt would balloon right back.
        foldedMessageCount: newFoldedMessageCount,
      },
    });
  }

  // Two-block system prompt: stable prefix is cacheable on Anthropic, the
  // volatile rolling summary lives in its own block so summarization
  // doesn't invalidate the cached prefix on the next turn.
  const systemPrompt = buildCacheableSystemPrompt({
    stable: `${DESIGN_SYSTEM_PROMPT}${critiqueBlock}${skillsBlock}`,
    summary: rolling.summary,
  });

  // Self-critique adds up to 3 extra revision rounds on top of the initial
  // pass — bump the step ceiling so the model can actually finish what it
  // committed to instead of hitting the wall mid-revision.
  const stepCeiling = selfCritique ? 48 : 24;

  const pricing = getModelPricing(provider, modelId);

  // Translate any error that flows out of the model stream into a tagged
  // payload our client can render as a friendly banner. The message is
  // sanitized first to strip any API key material that provider SDKs
  // occasionally embed in stack traces or error bodies.
  const errorMessageForClient = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const message = sanitizeErrorMessage(raw);
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
    // Pass the inbound messages so the AI SDK can detect the continuation
    // case (last message is an assistant message — happens when the
    // SDK auto-continues after a client-fulfilled tool like
    // `screenshotDesign`). When detected, `state.message` reuses the
    // existing assistant UIMessage (same id, existing parts), and any
    // new parts streamed by `streamText` append to it. `onFinish` then
    // receives a `responseMessage` whose `parts` are the FULL union —
    // original + continuation — under the same id. Combined with the
    // `db.message.upsert` below, this is what makes the screenshot URL
    // (which is filled in client-side AFTER the initial onFinish) end
    // up persisted to disk: the continuation request's onFinish
    // overwrites the prior row with the fully-resolved version.
    originalMessages: messages,
    execute: async ({ writer }) => {
      // `streamText` lives inside `execute` so `onStepFinish` can close over
      // `writer` — we stream a `data-session-usage` event after every agentic
      // step (not once at the end) so the context indicator updates in real
      // time as tokens accumulate across a long multi-tool turn.
      const result = streamText({
        model,
        system: systemPrompt,
        messages: sanitizeModelMessages(rolling.messages),
        tools,
        stopWhen: (state) =>
          stepCountIs(stepCeiling)(state) ||
          // Stop immediately after askClarifyingQuestions so the model
          // can't continue calling planDesign / design tools in subsequent
          // steps while the user is still being asked for input. The client
          // already blocks auto-continuation on the frontend, but this guard
          // prevents Gemini (and other models that ignore the tool's "end
          // your turn" instruction) from forging ahead server-side.
          (state.steps.at(-1)?.toolCalls.some(
            (tc) => tc?.toolName === "askClarifyingQuestions",
          ) ?? false),
        // Propagate the client's abort (Stop button -> useChat.stop()) all the
        // way down so we stop billing tokens immediately instead of letting
        // the model finish generating after the user has already cancelled.
        abortSignal: req.signal,
        onError: (err) => {
          console.error("[chat]", err);
        },
        // Fires after each individual step in the agentic loop. We persist
        // this step's usage atomically and push a fresh snapshot to the
        // client so the chat context indicator climbs step-by-step. If the
        // turn aborts mid-way, everything billed up to that point is already
        // safely in the ledger (no "partial turn was free" bug).
        onStepFinish: async ({ usage: stepUsage }) => {
          if (!stepUsage) return;
          const inputDelta = stepUsage.inputTokens ?? 0;
          const outputDelta = stepUsage.outputTokens ?? 0;
          const cacheRead = stepUsage.inputTokenDetails?.cacheReadTokens ?? 0;
          const cacheWrite = stepUsage.inputTokenDetails?.cacheWriteTokens ?? 0;
          const noCache = stepUsage.inputTokenDetails?.noCacheTokens ?? 0;

          // Cache observability — log a one-line summary per step so the
          // user can verify in `pnpm dev` output that prompt caching is
          // actually firing. Anthropic shows non-zero cacheRead/cacheWrite
          // explicitly; OpenAI/Gemini show non-zero cacheRead automatically
          // once their respective prefix-size threshold is hit.
          if (inputDelta > 0) {
            const hitRate =
              cacheRead > 0 ? Math.round((cacheRead / inputDelta) * 100) : 0;
            console.log(
              `[chat] step usage: in=${inputDelta} (noCache=${noCache} cacheRead=${cacheRead} cacheWrite=${cacheWrite} hit=${hitRate}%) out=${outputDelta} provider=${provider} model=${modelId}`,
            );
          }

          const stepCost =
            pricing !== null
              ? calculateCost(
                  {
                    inputTokens: stepUsage.inputTokens,
                    outputTokens: stepUsage.outputTokens,
                    noCacheInputTokens: stepUsage.inputTokenDetails?.noCacheTokens,
                    cacheReadInputTokens: stepUsage.inputTokenDetails?.cacheReadTokens,
                    cacheWriteInputTokens: stepUsage.inputTokenDetails?.cacheWriteTokens,
                  },
                  pricing,
                )
              : 0;

          if (inputDelta === 0 && outputDelta === 0 && stepCost === 0) return;

          try {
            const updated = await db.chatSession.update({
              where: { id: sessionId },
              data: {
                // `cumulativeInputTokens` is lifetime gross billing; not
                // surfaced in the UI but kept around for debugging since it
                // can be cross-referenced against the provider's dashboard.
                cumulativeInputTokens: { increment: inputDelta },
                // Lifetime assistant-token total — surfaced as "Output
                // tokens" in the popover.
                cumulativeOutputTokens: { increment: outputDelta },
                totalCostUsd: { increment: stepCost },
                // Live context fill — overwritten (not incremented). Drives
                // the popover ring AND serves as the summarization-trigger
                // floor when the user switches to a smaller-context model.
                lastInputTokens: inputDelta,
              },
              select: {
                summarizedCount: true,
                totalCostUsd: true,
                lastInputTokens: true,
                cumulativeOutputTokens: true,
                cumulativeFoldedTokens: true,
              },
            });

            writer.write({
              type: "data-session-usage",
              data: {
                sessionId,
                currentInputTokens: updated.lastInputTokens,
                lifetimeFoldedTokens: updated.cumulativeFoldedTokens,
                lifetimeOutputTokens: updated.cumulativeOutputTokens,
                summarizedCount: updated.summarizedCount,
                totalCostUsd: updated.totalCostUsd,
                // Summarization events are broadcast separately from the
                // top-level onFinish path below (they only fire once per
                // turn, not per step).
                justSummarized: false,
              } satisfies SessionUsageDataPart,
              transient: true,
            });
          } catch (err) {
            console.error("[chat] per-step usage persist failed", err);
          }
        },
      });

      writer.merge(result.toUIMessageStream({ onError: errorMessageForClient }));

      // Kick off auto-naming the moment we know the user just sent their
      // first message, in parallel with the model stream. The title is
      // derived from the user's intent alone, so there's no reason to wait
      // for the assistant to finish — users see the renamed tab almost
      // instantly instead of after the full turn (which can be many
      // seconds for long agent workflows). Errors are swallowed so a flaky
      // title model never disturbs the chat itself.
      //
      // We hold the promise and await it before `execute` returns so the
      // writer stays alive long enough for the `data-session-title`
      // payload to flush — without that await, the stream could close
      // before the title write lands and the client would never see it.
      const autoNamePromise = (async () => {
        if (!shouldAutoName) return;
        const userText = extractText(lastUserMessage!.parts);
        if (!userText) return;
        const title = await generateSessionTitle({
          activeProvider: provider,
          activeApiKey: apiKey,
          firstUserMessage: userText,
          firstAssistantMessage: "",
        });
        if (!title) return;
        // Atomic update — only flips the title when it's still the
        // default, so a manual rename mid-flight always wins.
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
      })().catch((err) => {
        console.error("[chat] auto-name failed", err);
      });

      // Token counts + cost are already persisted + streamed per step via
      // `onStepFinish` above. The only thing left to broadcast once per turn
      // is the summarization signal: increment `summarizedCount` and tell the
      // client to render the "context was summarized" in-chat marker. We also
      // wait on `result.finishReason` so any provider-side stream failures
      // are surfaced before execute() returns.
      try {
        await result.finishReason;
      } catch {
        // Errors here already flow through `onError` / `errorMessageForClient`
        // and back to the client as a chat-error payload. No further action.
      }

      if (rolling.summarized) {
        try {
          const updated = await db.chatSession.update({
            where: { id: sessionId },
            data: { summarizedCount: { increment: 1 } },
            select: {
              summarizedCount: true,
              totalCostUsd: true,
              // Re-read the lifetime stats so the client snapshot stays
              // consistent with what `onStepFinish` just persisted (and so
              // the indicator doesn't briefly blank when this event fires).
              lastInputTokens: true,
              cumulativeOutputTokens: true,
              cumulativeFoldedTokens: true,
            },
          });
          writer.write({
            type: "data-session-usage",
            data: {
              sessionId,
              currentInputTokens: updated.lastInputTokens,
              lifetimeFoldedTokens: updated.cumulativeFoldedTokens,
              lifetimeOutputTokens: updated.cumulativeOutputTokens,
              summarizedCount: updated.summarizedCount,
              totalCostUsd: updated.totalCostUsd,
              justSummarized: true,
            } satisfies SessionUsageDataPart,
            transient: true,
          });
        } catch (err) {
          console.error("[chat] summarization signal failed", err);
        }
      }

      // Title generation was kicked off at the top of `execute` and runs
      // alongside the model stream. Await it here so the stream stays open
      // until the `data-session-title` write has actually been flushed to
      // the client — otherwise a fast-finishing model could close the
      // stream before the title (which usually arrives later) gets a
      // chance to land.
      await autoNamePromise;
    },
    onFinish: async ({ responseMessage }) => {
      if (responseMessage.role === "assistant") {
        // Upsert (not create) so a continuation request — fired by the
        // SDK after a client-fulfilled tool like `screenshotDesign`
        // resolves — overwrites the prior persisted row instead of
        // creating a duplicate. With `originalMessages: messages` set
        // above, `responseMessage.id` stays stable across the original
        // emit and every continuation, and `responseMessage.parts`
        // grows to include client-filled outputs (e.g. the screenshot
        // URL) by the final continuation. The result on disk after the
        // turn fully settles is a single assistant row with the
        // screenshot thumbnail intact for refresh / scrollback.
        await db.message.upsert({
          where: { id: responseMessage.id },
          create: {
            id: responseMessage.id,
            sessionId,
            role: "assistant",
            parts: responseMessage.parts as object,
          },
          update: {
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
