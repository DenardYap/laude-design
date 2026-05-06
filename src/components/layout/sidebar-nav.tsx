"use client";

import Link from "next/link";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, EASE, DURATION } from "@/components/layout/utils/sidebar";
import type { SidebarNavProps } from "@/components/layout/types/layout";

export function SidebarNav({ pathname, collapsed }: SidebarNavProps) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>
              <Link
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand/40 text-ink"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span
                  style={{ transitionTimingFunction: EASE }}
                  className={cn(
                    "overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform]",
                    DURATION,
                    collapsed
                      ? "pointer-events-none max-w-0 -translate-x-1 opacity-0"
                      : "max-w-[160px] translate-x-0 opacity-100",
                  )}
                  aria-hidden={collapsed}
                >
                  {label}
                </span>
              </Link>
            </TooltipTrigger>
            {collapsed ? <TooltipContent side="right">{label}</TooltipContent> : null}
          </Tooltip>
        );
      })}
    </nav>
  );
}
