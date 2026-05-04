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

/**
 * Icon-only toggle living in the composer toolbar next to the model picker
 * and attachment button. Off by default. When on, the agent screenshots its
 * own design, critiques it, and revises (see the self-critique addendum
 * appended to `DESIGN_SYSTEM_PROMPT`).
 *
 * State is signalled the way every modern chat UI signals an "active mode"
 * toggle (Cursor's Auto, ChatGPT's Search, Claude's Extended thinking):
 *
 *   - **Off**: ghost — transparent background, muted icon. Recedes into
 *     the toolbar with the other neutral controls.
 *   - **On**: filled brand color — `bg-brand` + `text-brand-foreground`.
 *     Saturated warm gold against the composer's white/cream surface, so
 *     the active state is unmistakable at a glance.
 *
 * We deliberately do NOT use the canvas toolbar's `bg-brand-soft` pattern
 * here — `--brand-soft` is only ~6% darker than the surface, which made
 * the toggle visually ambiguous. The drawing shape bar uses an additional
 * `ring-2 ring-brand` for the same reason; a solid fill is even cleaner
 * and matches user expectations from other chat products.
 */
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
