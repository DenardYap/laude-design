"use client";

import { FileScan } from "lucide-react";

import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { SelfCritiqueToggleProps } from "@/components/workspace/chat/types/misc";

export function SelfCritiqueToggle({
  sessionId,
  disabled,
}: SelfCritiqueToggleProps) {
  const enabled = useWorkspaceStore(
    (s) => s.selfCritiqueBySession[sessionId] ?? false,
  );
  const setSelfCritique = useWorkspaceStore((s) => s.setSelfCritique);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          aria-label={
            enabled ? "Turn self-critique off" : "Turn self-critique on"
          }
          aria-pressed={enabled}
          disabled={disabled}
          onClick={() => setSelfCritique(sessionId, !enabled)}
          className={cn(
            "size-7 transition-colors",
            enabled &&
              "bg-brand text-brand-foreground hover:bg-brand-hover hover:text-brand-foreground",
          )}
          icon={<FileScan className="size-3.5" />}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[16rem] text-[11px]">
        <span className="font-medium">
          Self-critique {enabled ? "on" : "off"}
        </span>
        <span className="block opacity-80">
          {enabled
            ? "Agent will screenshot its design, critique it, and revise (max 3 rounds)."
            : "Turn on to have the agent review and revise its own design before replying."}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
