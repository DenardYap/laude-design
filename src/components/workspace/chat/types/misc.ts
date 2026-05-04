import type { TagMarker } from "@/lib/workspace/tag-markers";

export interface InlineDesignPlanProps {
  /** Plan id from the planDesign tool call's output. May be undefined while still streaming. */
  planId?: string;
  /** Pulled from the tool call's input so the checklist renders before output lands. */
  fallbackTitle?: string;
  fallbackSteps?: { id: string; label: string }[];
}

export interface SelfCritiqueToggleProps {
  sessionId: string;
  /** Disable while a turn is in flight — flipping it mid-stream is confusing. */
  disabled?: boolean;
}

export interface TagChipProps {
  tag: TagMarker;
  /** When provided, the chip shows a remove button (composer use). */
  onRemove?: () => void;
  className?: string;
}

export interface MarkdownProps {
  children: string;
  className?: string;
}
