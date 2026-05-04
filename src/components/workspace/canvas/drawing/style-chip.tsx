"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StyleChip({
  active,
  onClick,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-surface px-2 text-xs text-ink transition-colors hover:bg-surface-sunken",
        active && "border-brand bg-brand-soft hover:bg-brand-soft",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
