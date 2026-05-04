"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { ClonedFromBannerProps } from "@/components/skills/types/skill-detail";

export function ClonedFromBanner({ clonedFrom }: ClonedFromBannerProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-sunken/50 px-3 py-2 text-xs text-ink-muted">
      <ArrowUpRight className="size-3.5 shrink-0" />
      <span>
        Cloned from{" "}
        <Link
          href={`/skills/${clonedFrom.id}`}
          className="font-medium text-ink underline-offset-2 hover:underline"
        >
          {clonedFrom.name}
        </Link>
      </span>
    </div>
  );
}
