"use client";

import * as React from "react";
import {
  Copy,
  KeyRound,
  ArrowRight,
  AlertTriangle,
  Clock,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";
import { match, P } from "ts-pattern";
import { toast } from "sonner";

import { IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { isInternalNote } from "@/lib/workspace/internal-notes";
import { isTagMarker, parseTagMarker } from "@/lib/workspace/tag-markers";
import {
  type ChatError,
  PROVIDER_DISPLAY,
} from "@/components/workspace/chat/chat-errors";
import { Markdown } from "@/components/workspace/chat/markdown";
import { getToolDisplay } from "@/components/workspace/chat/tool-display";
import { InlineDesignPlan } from "@/components/workspace/chat/inline-design-plan";
import { InlineClarifyingQuestions } from "@/components/workspace/chat/inline-clarifying-questions";
import { TagChip } from "@/components/workspace/chat/tag-chip";
import type { ClarifyingQuestionItem } from "@/app/api/sessions/[sessionId]/questions/route";

interface MessageListProps {
  sessionId: string;
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  chatError?: ChatError | null;
}

export function MessageList({
  sessionId,
  messages,
  status,
  chatError,
}: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // A tool call is "in flight" only while the chat is actively streaming.
  // Once status flips to ready/error (including when the user hits Stop),
  // any tool whose state is still input-* is treated as finished — there's
  // no more network activity that could resolve it.
  const isStreaming = status === "submitted" || status === "streaming";

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-ink-muted">
        Start chatting with your agent.
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {messages.map((m) => (
        <MessageRow
          key={m.id}
          message={m}
          isStreaming={isStreaming}
          sessionId={sessionId}
        />
      ))}
      {isStreaming ? <WorkingIndicator /> : null}
      {chatError ? <ChatErrorBanner error={chatError} /> : null}
    </div>
  );
}

function MessageRow({
  message,
  isStreaming,
  sessionId,
}: {
  message: UIMessage;
  isStreaming: boolean;
  sessionId: string;
}) {
  const isUser = message.role === "user";
  const text = collectText(message.parts);

  return (
    <div className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "text-sm leading-relaxed text-ink",
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand-soft px-3 py-2"
            : "w-full",
        )}
      >
        {message.parts.map((part, i) => (
          <MessagePartView
            key={i}
            part={part}
            isUser={isUser}
            isStreaming={isStreaming}
            sessionId={sessionId}
          />
        ))}
      </div>
      {!isUser && text ? (
        <IconButton
          aria-label="Copy message"
          className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
          icon={<Copy className="size-3" />}
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast.success("Copied");
          }}
        />
      ) : null}
    </div>
  );
}

function MessagePartView({
  part,
  isUser,
  isStreaming,
  sessionId,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  isUser: boolean;
  isStreaming: boolean;
  sessionId: string;
}) {
  return match(part)
    .with({ type: "text" }, (p) => {
      if (isInternalNote(p.text)) return null;
      const tag = parseTagMarker(p.text);
      if (tag) {
        return (
          <span className="my-1 mr-1 inline-flex max-w-full align-middle">
            <TagChip tag={tag} />
          </span>
        );
      }
      return isUser ? (
        <p className="whitespace-pre-wrap break-words">{p.text}</p>
      ) : (
        <Markdown>{p.text}</Markdown>
      );
    })
    .with({ type: "reasoning" }, (p) => (
      <p className="whitespace-pre-wrap text-xs italic text-ink-muted">{p.text}</p>
    ))
    .with({ type: "file" }, (p) => (
      <FileAttachment mediaType={p.mediaType} url={p.url} filename={p.filename} />
    ))
    .with({ type: "tool-planDesign" }, (p) => {
      // Render the live checklist inline at the tool call's position.
      // Output (planId) lands once execution finishes; until then we use
      // the partial input so the user sees the plan immediately.
      const anyPart = p as {
        input?: { title?: string; steps?: { id: string; label: string }[] };
        output?: { planId?: string };
      };
      return (
        <InlineDesignPlan
          planId={anyPart.output?.planId}
          fallbackTitle={anyPart.input?.title}
          fallbackSteps={anyPart.input?.steps}
        />
      );
    })
    .with({ type: "tool-askClarifyingQuestions" }, (p) => {
      // Render the questions interactively, inline at the tool call's
      // position. Without this, the chat shows just a tiny "Asked
      // clarifying questions" indicator while the actual UI lives in a
      // separate canvas region — and users perceive the agent as "stuck"
      // because there's no in-place affordance for what to do next.
      const anyPart = p as {
        input?: { rationale?: string; questions?: ClarifyingQuestionItem[] };
        output?: { questionSetId?: string };
      };
      return (
        <InlineClarifyingQuestions
          sessionId={sessionId}
          questionSetId={anyPart.output?.questionSetId}
          fallbackRationale={anyPart.input?.rationale}
          fallbackItems={anyPart.input?.questions}
        />
      );
    })
    .with({ type: "tool-completePlanStep" }, (p) => {
      // Custom label: "Completed step 3" instead of generic "Completed step".
      const anyPart = p as { output?: { stepNumber?: number } };
      const num = anyPart.output?.stepNumber;
      return (
        <ToolCallView
          part={p}
          isStreaming={isStreaming}
          labelOverride={
            num !== undefined
              ? {
                  active: `Completing step ${num}`,
                  past: `Completed step ${num}`,
                }
              : undefined
          }
        />
      );
    })
    .with({ type: P.string.startsWith("tool-") }, (p) => (
      <ToolCallView part={p} isStreaming={isStreaming} />
    ))
    .with({ type: "dynamic-tool" }, (p) => (
      <ToolCallView part={p} isStreaming={isStreaming} />
    ))
    .with({ type: "step-start" }, () => null)
    .otherwise(() => null);
}

function FileAttachment({
  mediaType,
  url,
  filename,
}: {
  mediaType: string;
  url: string;
  filename?: string;
}) {
  if (mediaType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={filename ?? "attachment"}
        className="my-1 max-h-48 rounded-md border border-border"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="my-1 inline-block rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-sunken"
    >
      {filename ?? mediaType}
    </a>
  );
}

function ToolCallView({
  part,
  isStreaming,
  labelOverride,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
  isStreaming: boolean;
  labelOverride?: { active: string; past: string };
}) {
  const anyPart = part as {
    type: string;
    toolName?: string;
    state?: string;
    errorText?: string;
  };
  const toolName = anyPart.toolName ?? anyPart.type.replace(/^tool-/, "");
  const display = getToolDisplay(toolName);
  const activeLabel = labelOverride?.active ?? display.activeLabel;
  const pastLabel = labelOverride?.past ?? display.pastLabel;
  const Icon = display.icon;

  // The AI SDK marks a tool part as still pending while it's in either
  // 'input-streaming' or 'input-available'. Once it resolves it transitions
  // to 'output-available' / 'output-error' / 'output-denied'. If the user
  // hits Stop mid-call, the part is frozen in an input-* state but the chat
  // status flips to 'ready'/'error' — so we also treat any in-flight tool
  // as "done" once streaming ends, which surfaces the past-tense label
  // without an animation. This matches the user's mental model: the work
  // either finished or isn't happening any more.
  const isPending =
    isStreaming &&
    (anyPart.state === "input-streaming" || anyPart.state === "input-available");
  const hasError =
    anyPart.state === "output-error" || Boolean(anyPart.errorText);

  return (
    <div className="my-1 pl-3 text-xs text-ink-subtle">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 shrink-0" aria-hidden />
        <span>
          {isPending ? activeLabel : pastLabel}
          {isPending ? <AnimatedEllipsis /> : null}
        </span>
      </div>
      {hasError && anyPart.errorText ? (
        <div className="mt-0.5 pl-[18px] text-destructive">
          {anyPart.errorText}
        </div>
      ) : null}
    </div>
  );
}

function AnimatedEllipsis() {
  // Cycles "." → ".." → "..." → "." …  All three dots are always rendered so
  // the trailing label width stays fixed (no layout jitter as the count
  // changes) — we just toggle opacity on the dots that aren't "shown" yet.
  const [count, setCount] = React.useState(1);
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setCount((c) => (c % 3) + 1);
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span aria-hidden className="inline-flex">
      <span className={count >= 1 ? "opacity-100" : "opacity-0"}>.</span>
      <span className={count >= 2 ? "opacity-100" : "opacity-0"}>.</span>
      <span className={count >= 3 ? "opacity-100" : "opacity-0"}>.</span>
    </span>
  );
}

function ChatErrorBanner({ error }: { error: ChatError }) {
  const content = match(error)
    .with({ type: "api-key-missing" }, ({ provider }) => ({
      icon: <KeyRound className="mt-0.5 size-4 shrink-0 text-destructive" />,
      body: (
        <>
          <p className="text-ink">
            No API key configured for{" "}
            <span className="font-medium">{providerName(provider)}</span>. Add
            your key to start chatting.
          </p>
          <ConfigureKeysLink />
        </>
      ),
    }))
    .with({ type: "api-key-invalid" }, ({ provider }) => ({
      icon: <KeyRound className="mt-0.5 size-4 shrink-0 text-destructive" />,
      body: (
        <>
          <p className="text-ink">
            Your{" "}
            <span className="font-medium">{providerName(provider)}</span> API
            key was rejected. Double-check it&apos;s active and has access to
            this model.
          </p>
          <ConfigureKeysLink label="Update API keys" />
        </>
      ),
    }))
    .with({ type: "rate-limit" }, ({ provider }) => ({
      icon: <Clock className="mt-0.5 size-4 shrink-0 text-warning" />,
      body: (
        <p className="text-ink">
          {provider ? providerName(provider) : "Your provider"} hit a rate
          limit. Wait a moment and send the message again.
        </p>
      ),
    }))
    .with({ type: "model-not-found" }, ({ modelId }) => ({
      icon: (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      ),
      body: (
        <p className="text-ink">
          {modelId ? (
            <>
              Model <span className="font-mono text-xs">{modelId}</span> isn
              &apos;t available on your account.
            </>
          ) : (
            <>The selected model isn&apos;t available on your account.</>
          )}{" "}
          Pick a different one from the model picker.
        </p>
      ),
    }))
    .with({ type: "network" }, () => ({
      icon: <WifiOff className="mt-0.5 size-4 shrink-0 text-destructive" />,
      body: (
        <p className="text-ink">
          Couldn&apos;t reach the server. Check your connection and try again.
        </p>
      ),
    }))
    .with({ type: "generic" }, ({ message }) => ({
      icon: (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      ),
      body: (
        <>
          <p className="text-ink">Something went wrong while sending.</p>
          {message ? (
            <p className="text-xs text-ink-muted">{message}</p>
          ) : null}
        </>
      ),
    }))
    .exhaustive();

  return (
    <div className="flex items-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-destructive-soft px-3 py-2.5 text-sm">
        <div className="flex items-start gap-2">
          {content.icon}
          <div className="space-y-2">{content.body}</div>
        </div>
      </div>
    </div>
  );
}

function providerName(provider: string) {
  return PROVIDER_DISPLAY[provider] ?? provider;
}

function ConfigureKeysLink({ label = "Configure API keys" }: { label?: string }) {
  return (
    <Link
      href="/api-keys"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-ink underline-offset-2 hover:underline"
    >
      {label}
      <ArrowRight className="size-3" />
    </Link>
  );
}

// Always visible while a turn is in flight, including the gaps between
// streamed text, tool calls, and reasoning. Without a continuous "still
// working" signal users assume the agent has stalled the moment it pauses
// — even if more output is on the way (Norman: feedback must be continuous).
function WorkingIndicator() {
  return (
    <div className="flex items-start px-1 pt-1">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2 py-1 text-[11px] font-medium text-ink-muted">
        <span className="inline-flex gap-0.5" aria-hidden>
          <span className="size-1 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.3s]" />
          <span className="size-1 animate-bounce rounded-full bg-ink-muted [animation-delay:-0.15s]" />
          <span className="size-1 animate-bounce rounded-full bg-ink-muted" />
        </span>
        <span>Working</span>
      </span>
    </div>
  );
}

function collectText(parts: UIMessagePart<UIDataTypes, UITools>[]) {
  return parts
    .map((p) =>
      match(p)
        .with({ type: "text" }, (x) =>
          isInternalNote(x.text) || isTagMarker(x.text) ? "" : x.text,
        )
        .otherwise(() => ""),
    )
    .join("\n")
    .trim();
}
