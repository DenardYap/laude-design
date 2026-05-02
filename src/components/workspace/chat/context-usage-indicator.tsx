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
import { useWorkspaceStore } from "@/stores/workspace-store";
import { getContextWindow, resolveModelOption } from "@/lib/workspace/types";

interface ContextUsageIndicatorProps {
  projectId: string;
  sessionId: string;
}

const ZERO_USAGE = {
  cumulativeInputTokens: 0,
  cumulativeOutputTokens: 0,
  summarizedCount: 0,
  totalCostUsd: 0,
} as const;

const numberFormatter = new Intl.NumberFormat("en-US");
// Cost is small per turn (often fractions of a cent), so we render with up to
// 4 fractional digits when it's under $1 and 2 above that. Prevents "$0.00"
// for a turn that actually cost $0.0023.
function formatCost(usd: number): string {
  if (usd < 0.01) {
    return `$${usd.toFixed(4)}`;
  }
  if (usd < 1) {
    return `$${usd.toFixed(3)}`;
  }
  return `$${usd.toFixed(2)}`;
}

export function ContextUsageIndicator({
  projectId,
  sessionId,
}: ContextUsageIndicatorProps) {
  const usage =
    useWorkspaceStore((s) => s.sessionUsageById[sessionId]) ?? ZERO_USAGE;
  const selected = useWorkspaceStore(
    (s) => s.selectedModelByProject[projectId],
  );

  const active = resolveModelOption(selected);
  const contextWindow = getContextWindow(active.provider, active.modelId);

  const totalTokens =
    usage.cumulativeInputTokens + usage.cumulativeOutputTokens;
  const ratio = contextWindow > 0 ? totalTokens / contextWindow : 0;
  // Visual fill caps at 100% even when cumulative tokens overshoot the
  // context window — at that point rolling summarization keeps the live
  // window bounded, so the ring saturates rather than wrapping.
  const visualRatio = Math.min(1, Math.max(0, ratio));
  const percent = Math.round(visualRatio * 100);

  // Color escalates as fill approaches the limit: brand below 80%, warning
  // 80-100%, destructive past 100%. Uses currentColor so the SVG stroke
  // tracks whatever className is on the wrapping span.
  const tone =
    ratio > 1
      ? "text-destructive"
      : ratio > 0.8
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
        <TooltipContent side="top">
          {percent}% of context · {formatCost(usage.totalCostUsd)}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" sideOffset={8} className="w-64 p-3">
        <div className="space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-subtle">
              Context used
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                {numberFormatter.format(totalTokens)}
                <span className="text-ink-muted">
                  {" / "}
                  {numberFormatter.format(contextWindow)}
                </span>
              </span>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  tone,
                )}
              >
                {percent}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  ratio > 1
                    ? "bg-destructive"
                    : ratio > 0.8
                      ? "bg-warning"
                      : "bg-brand-hover",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            {ratio > 1 ? (
              <div className="mt-2 text-[11px] leading-snug text-ink-muted">
                Past the model&apos;s context window — rolling summarization
                folds older messages so the live request stays bounded.
              </div>
            ) : null}
          </div>

          <div className="border-t border-border" />

          <UsageRow
            label="Input tokens"
            value={numberFormatter.format(usage.cumulativeInputTokens)}
          />
          <UsageRow
            label="Output tokens"
            value={numberFormatter.format(usage.cumulativeOutputTokens)}
          />
          <UsageRow
            label="Summarized"
            value={
              usage.summarizedCount === 1
                ? "1 time"
                : `${usage.summarizedCount} times`
            }
          />

          <div className="border-t border-border" />

          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink-muted">Estimated cost</span>
            <span className="text-sm font-semibold text-ink tabular-nums">
              {formatCost(usage.totalCostUsd)}
            </span>
          </div>
          <p className="text-[10px] leading-snug text-ink-subtle">
            Estimated from public list pricing for the selected chat model.
            Auxiliary calls (titler, summarizer) are not included.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface UsageRingProps {
  ratio: number;
  className?: string;
}

// Stroke-dasharray ring. `r=7.25` with stroke-width 2.5 inside a 20-unit
// viewBox leaves enough padding for the rounded stroke caps to render fully.
// The progress arc rotates -90deg so 0% sits at the 12 o'clock position;
// that matches Cursor's indicator and how progress rings are conventionally
// read. The track uses a solid `--border-strong` color (rather than a faded
// `currentColor`) so an empty ring is still clearly visible against the
// composer's surface — the fill arc uses `currentColor` so the tone class
// on the parent controls it.
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

interface UsageRowProps {
  label: string;
  value: string;
}

function UsageRow({ label, value }: UsageRowProps) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}
