"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  resolveSessionModel,
  useWorkspaceStore,
} from "@/stores/workspace-store";
import {
  getContextWindow,
  resolveModelOption,
} from "@/lib/workspace/utils/models";
import { getLifetimeInputTokens } from "@/lib/workspace/types";
import type { ContextUsageIndicatorProps } from "@/components/workspace/chat/types/context-usage";
import {
  ZERO_USAGE,
  numberFormatter,
  formatCost,
} from "@/components/workspace/chat/utils/format-usage";
import { UsageRow } from "@/components/workspace/chat/usage-row";

export function SessionUsagePopoverPanel({
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
    currentRatio > 0.8
      ? "text-destructive"
      : currentRatio > 0.6
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
