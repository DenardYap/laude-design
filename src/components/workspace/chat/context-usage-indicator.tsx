"use client";

import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  resolveSessionModel,
  useWorkspaceStore,
} from "@/stores/workspace-store";
import {
  getContextWindow,
  getLifetimeInputTokens,
  resolveModelOption,
} from "@/lib/workspace/types";
import type {
  ContextUsageIndicatorProps,
  UsageRingProps,
  UsageRowProps,
} from "@/components/workspace/chat/types/context-usage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_USAGE = {
  currentInputTokens: 0,
  lifetimeFoldedTokens: 0,
  lifetimeOutputTokens: 0,
  summarizedCount: 0,
  totalCostUsd: 0,
} as const;

const numberFormatter = new Intl.NumberFormat("en-US");

// Cost is small per turn (often fractions of a cent), so we render with up to
// 4 fractional digits when it's under $1 and 2 above that. Prevents "$0.00"
// for a turn that actually cost $0.0023.
function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// UsageRing — circular progress indicator
// ---------------------------------------------------------------------------

// Stroke-dasharray ring. `r=7.25` with stroke-width 2.5 inside a 20-unit
// viewBox leaves enough padding for the rounded stroke caps to render fully.
// The progress arc rotates -90deg so 0% sits at the 12 o'clock position.
// The track uses a solid `--border-strong` color so an empty ring is clearly
// visible against the composer's surface; the fill arc uses `currentColor`
// so the tone class on the parent controls it.
function UsageRing({ ratio, className }: UsageRingProps) {
  const radius = 7.25;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;
  return (
    <svg
      viewBox="0 0 20 20"
      role="img"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="hsl(var(--border-strong))"
        strokeWidth="2.5"
        fill="none"
      />
      {dash > 0 ? (
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 10 10)"
        />
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// UsageRow — label + value pair
// ---------------------------------------------------------------------------

function UsageRow({ label, value }: UsageRowProps) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionUsagePopoverPanel — reads store directly; no prop drilling
// ---------------------------------------------------------------------------

function SessionUsagePopoverPanel({
  projectId,
  sessionId,
}: ContextUsageIndicatorProps) {
  const usage =
    useWorkspaceStore((s) => s.sessionUsageById[sessionId]) ?? ZERO_USAGE;
  const selected = useWorkspaceStore((s) =>
    resolveSessionModel(sessionId, projectId, s),
  );

  const active = resolveModelOption(selected);
  const contextWindow = getContextWindow(active.provider, active.modelId);
  const currentTokens = usage.currentInputTokens;
  const currentRatio = contextWindow > 0 ? currentTokens / contextWindow : 0;
  const percent = Math.round(Math.min(1, Math.max(0, currentRatio)) * 100);
  const lifetimeInputTokens = getLifetimeInputTokens(usage);

  const tone =
    currentRatio > 0.9
      ? "text-destructive"
      : currentRatio > 0.7
        ? "text-warning"
        : "text-brand-hover";

  return (
    <div className="space-y-3">
      {/* Current context window fill */}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-ink-subtle">
          Current context
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-ink">
            {numberFormatter.format(currentTokens)}
            <span className="text-ink-muted">
              {" / "}
              {numberFormatter.format(contextWindow)}
            </span>
          </span>
          <span className={cn("text-xs font-medium tabular-nums", tone)}>
            {percent}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              currentRatio > 0.9
                ? "bg-destructive"
                : currentRatio > 0.7
                  ? "bg-warning"
                  : "bg-brand-hover",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        {currentRatio > 1 ? (
          <div className="mt-2 text-[11px] leading-snug text-destructive/80">
            Exceeds this model&apos;s context window. Rolling summarization will
            fold older messages on the next turn.
          </div>
        ) : usage.summarizedCount > 0 ? (
          <div className="mt-2 text-[11px] leading-snug text-ink-muted">
            Rolling summarization has folded older messages{" "}
            {usage.summarizedCount === 1
              ? "once"
              : `${usage.summarizedCount} times`}{" "}
            to keep the live request bounded.
          </div>
        ) : null}
      </div>

      <div className="border-t border-border" />

      {/* Lifetime totals — both rows are monotonic across the session.
          Input grows when summarization fires by absorbing the folded-token
          size into the running total; Output is the sum of every assistant
          token ever generated. */}
      <div className="text-[11px] uppercase tracking-wide text-ink-subtle">
        Lifetime totals
      </div>
      <UsageRow
        label="Input tokens"
        value={numberFormatter.format(lifetimeInputTokens)}
      />
      <UsageRow
        label="Output tokens"
        value={numberFormatter.format(usage.lifetimeOutputTokens)}
      />
      <UsageRow
        label="Summarized"
        value={
          usage.summarizedCount === 0
            ? "Never"
            : usage.summarizedCount === 1
              ? "1 time"
              : `${usage.summarizedCount} times`
        }
      />

      <div className="border-t border-border" />

      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-muted">Total session cost</span>
        <span className="text-sm font-semibold text-ink tabular-nums">
          {formatCost(usage.totalCostUsd)}
        </span>
      </div>
      <p className="text-[10px] leading-snug text-ink-subtle">
        Estimated from public list pricing for the selected chat model with
        provider prompt-cache rates applied where available. Auxiliary calls
        (titler, summarizer) billed to your key are not included.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextUsageIndicator — public API
// ---------------------------------------------------------------------------

export function ContextUsageIndicator({
  projectId,
  sessionId,
}: ContextUsageIndicatorProps) {
  const usage =
    useWorkspaceStore((s) => s.sessionUsageById[sessionId]) ?? ZERO_USAGE;
  const selected = useWorkspaceStore((s) =>
    resolveSessionModel(sessionId, projectId, s),
  );

  const active = resolveModelOption(selected);
  const contextWindow = getContextWindow(active.provider, active.modelId);
  const currentTokens = usage.currentInputTokens;
  const currentRatio = contextWindow > 0 ? currentTokens / contextWindow : 0;
  const visualRatio = Math.min(1, Math.max(0, currentRatio));
  const percent = Math.round(visualRatio * 100);

  const tone =
    currentRatio > 0.9
      ? "text-destructive"
      : currentRatio > 0.7
        ? "text-warning"
        : "text-brand-hover";

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Session usage"
              className="inline-flex size-7 items-center justify-center rounded-full transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UsageRing
                ratio={visualRatio}
                className={cn("size-[18px]", tone)}
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{percent}% of context used</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" sideOffset={8} className="w-64 p-3">
        <SessionUsagePopoverPanel
          projectId={projectId}
          sessionId={sessionId}
        />
      </PopoverContent>
    </Popover>
  );
}
