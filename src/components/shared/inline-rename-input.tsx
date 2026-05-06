"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { InlineRenameInputProps } from "@/components/shared/types/inline-rename-input";

/**
 * Inline rename field shared by the file tree, 
 * session subtabs, and canvas subtabs. 
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

  // Focus and select-all after double-clicking
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
