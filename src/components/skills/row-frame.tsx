"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { RowFrameProps } from "@/components/skills/types/skill-row";

export function RowFrame({ href, ariaLabel, zebra, children, colSpan }: RowFrameProps) {
  return (
    <li
      className={cn(
        "group relative grid grid-cols-subgrid items-center",
        zebra ? "bg-surface-sunken/30" : "bg-transparent",
        "hover:bg-surface-sunken",
      )}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <Link
        href={href}
        aria-label={ariaLabel}
        className="absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {children}
    </li>
  );
}
