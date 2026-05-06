"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/utils/sidebar";
import type { SidebarMobileProps } from "@/components/layout/types/layout";

export function SidebarMobile({ pathname, open, onOpenChange }: SidebarMobileProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showDefaultClose={false}
        className="left-0 top-0 h-[100dvh] w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-0 border-r border-border bg-surface p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left md:hidden"
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-3 py-3">
            <Link
              href="/projects"
              className="flex min-w-0 items-center gap-2"
              onClick={() => onOpenChange(false)}
            >
              <Image
                src="/logo.png"
                alt="Laude Design"
                width={36}
                height={36}
                className="size-9 shrink-0"
                priority
              />
              <span className="text-sm font-semibold tracking-tight text-ink">Laude Design</span>
            </Link>
            <IconButton
              aria-label="Close menu"
              icon={<X className="size-4" />}
              onClick={() => onOpenChange(false)}
            />
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand/40 text-ink"
                      : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </DialogContent>
    </Dialog>
  );
}
