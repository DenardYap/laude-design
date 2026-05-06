"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";

import { IconButton } from "@/components/ui";
import type { TopbarMobileNavProps } from "@/components/layout/types/layout";

export function TopbarMobileNav({ onMenuOpen }: TopbarMobileNavProps) {
  return (
    <>
      <IconButton
        aria-label="Open menu"
        className="md:hidden"
        icon={<Menu className="size-5" />}
        onClick={onMenuOpen}
      />
      <Link
        href="/projects"
        className="flex min-w-0 items-center gap-2 md:hidden"
        aria-label="Laude Design — projects"
      >
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0"
          priority
        />
        <span className="truncate text-sm font-semibold tracking-tight text-ink">
          Laude Design
        </span>
      </Link>
    </>
  );
}
