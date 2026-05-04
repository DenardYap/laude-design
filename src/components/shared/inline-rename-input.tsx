"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { InlineRenameInputProps } from "@/components/shared/types/inline-rename-input";

/**
 * Inline rename field shared by the file tree, session subtabs, and canvas
 * subtabs. Two design constraints (Norman: lack of feedback → loss of
 * control — the user must always be able to tell that the system has
 * accepted them into edit mode):
 *
 *   1. The editing state must be visually distinct from the resting state.
 *      We use a tinted background + 1-px ring so the chip clearly "lights
 *      up" the moment the field is mounted. Text is auto-selected on focus
 *      so the user can immediately type a replacement.
 *   2. The field sizes to its text via a hidden inline sizer (rather than
 *      stretching the row), so the affordance "wraps" the name like a chip
 *      instead of reading as a long empty form input. (CSS `field-sizing:
 *      content` would do this natively but isn't in Safari/Firefox yet.)
 *
 * The component also stops mousedown/click/dblclick propagation so it
 * doesn't accidentally trigger drag-to-reorder, tab selection, or
 * row-level handlers from the host.
 */
export function InlineRenameInput({
  initialValue,
  onCommit,
  onCancel,
  size = "sm",
  variant = "sunken",
}: InlineRenameInputProps) {
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select-all after mount. We defer via rAF because Radix
  // ContextMenu restores focus to the trigger element asynchronously after
  // closing, which would steal focus away from autoFocus before the user sees
  // the selection. The rAF fires after Radix finishes its focus-restore,
  // guaranteeing the text is highlighted regardless of how rename was invoked
  // (double-click, keyboard, or context menu).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const sizeCls = size === "xs" ? "text-xs" : "text-sm";
  const padCls = "px-1 py-px";
  const variantCls =
    variant === "raised"
      ? "bg-surface ring-border-strong"
      : "bg-surface-sunken ring-border-strong/70";

  return (
    <span className="relative inline-flex min-w-0 max-w-full items-stretch">
      <span
        aria-hidden="true"
        className={cn("invisible whitespace-pre", padCls, sizeCls)}
      >
        {/* nbsp keeps the wrapper from collapsing to 0px when the field is empty */}
        {draft || "\u00A0"}
      </span>
      <input
        ref={inputRef}
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
        className={cn(
          "absolute inset-0 rounded-sm text-ink",
          padCls,
          sizeCls,
          "outline-none ring-1",
          variantCls,
          "focus-visible:ring-ring",
        )}
      />
    </span>
  );
}
