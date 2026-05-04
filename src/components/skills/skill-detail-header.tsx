"use client";

import type { ReactNode } from 'react';

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { IconButton } from "@/components/ui";

interface SkillDetailHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** Shared header for both owner and public skill detail pages. */
export function SkillDetailHeader({ title, subtitle, actions }: SkillDetailHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <Link href="/skills" aria-label="Back to skills" className="shrink-0">
        <IconButton
          aria-label="Back to skills"
          variant="ghost"
          icon={<ArrowLeft className="size-4" />}
        />
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <div className="text-xs text-ink-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
