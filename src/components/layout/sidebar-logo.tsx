"use client";

import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { EASE, DURATION } from "@/components/layout/utils/sidebar";
import type { SidebarLogoProps } from "@/components/layout/types/layout";

export function SidebarLogo({ collapsed }: SidebarLogoProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <Link href="/projects" className="flex min-w-0 flex-1 items-center gap-2">
        <Image
          src="/logo.png"
          alt="Laude Design"
          width={36}
          height={36}
          className="size-9 shrink-0"
          priority
        />
        <span
          style={{ transitionTimingFunction: EASE }}
          className={cn(
            "overflow-hidden whitespace-nowrap text-sm font-semibold tracking-tight text-ink transition-[max-width,opacity,transform]",
            DURATION,
            collapsed
              ? "pointer-events-none max-w-0 -translate-x-1 opacity-0"
              : "max-w-[160px] translate-x-0 opacity-100",
          )}
          aria-hidden={collapsed}
        >
          Laude Design
        </span>
      </Link>
    </div>
  );
}
