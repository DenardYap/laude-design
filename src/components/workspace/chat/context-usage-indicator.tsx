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
  resolveModelOption,
} from "@/lib/workspace/utils/models";
import type { ContextUsageIndicatorProps } from "@/components/workspace/chat/types/context-usage";
import { ZERO_USAGE } from "@/components/workspace/chat/utils/format-usage";
import { UsageRing } from "@/components/workspace/chat/usage-ring";
import { SessionUsagePopoverPanel } from "@/components/workspace/chat/session-usage-popover-panel";

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
    currentRatio > 0.8
      ? "text-destructive"
      : currentRatio > 0.6
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
