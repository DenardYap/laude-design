"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface InlineRenameInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/**
 * Inline rename field shared by folder + design rows. Two design constraints:
 *
 *   1. The editing state must be visually distinct from the resting row
 *      (Norman: lack of feedback → loss of control). We use a soft sunken
 *      background + 1px ring.
 *   2. The field must size to its text, not stretch the whole row, so the
 *      affordance "wraps" the name like a chip rather than reading as a long
 *      empty form input. We achieve this with a hidden inline sizer span:
 *      the wrapper's intrinsic width tracks the sizer's text, and the input
 *      absolutely fills the wrapper. (CSS `field-sizing: content` would do
 *      this natively but isn't in Safari/Firefox yet.)
 */
export function InlineRenameInput({ initialValue, onCommit, onCancel }: InlineRenameInputProps) {
  const [draft, setDraft] = React.useState(initialValue);

  return (
    <span className="relative inline-flex min-w-0 max-w-full items-stretch">
      <span aria-hidden="true" className="invisible whitespace-pre px-1 py-px text-sm">
        {/* nbsp keeps the wrapper from collapsing to 0px when the field is empty */}
        {draft || "\u00A0"}
      </span>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onCommit(draft);
          if (e.key === "Escape") {
            setDraft(initialValue);
            onCancel();
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        className={cn(
          "absolute inset-0 rounded-sm bg-surface-sunken px-1 py-px text-sm text-ink",
          "outline-none ring-1 ring-border-strong/70",
          "focus-visible:ring-ring",
        )}
      />
    </span>
  );
}
