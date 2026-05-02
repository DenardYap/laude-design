"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, FolderKanban, KeyRound, Wand2 } from "lucide-react";

import {
  IconButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/api-keys", label: "Configure API", icon: KeyRound },
  { href: "/skills", label: "Skills", icon: Wand2 },
];

const EASE = "cubic-bezier(0.32,0.72,0,1)";
const DURATION = "duration-300";

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  return (
    <aside
      style={{ transitionTimingFunction: EASE }}
      className={cn(
        "flex h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width]",
        DURATION,
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <Link
          href="/projects"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
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

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
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

      <div className="flex justify-start px-3 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleSidebar}
              icon={
                <ChevronsLeft
                  style={{ transitionTimingFunction: EASE }}
                  className={cn(
                    "size-4 transition-transform",
                    DURATION,
                    collapsed && "rotate-180",
                  )}
                />
              }
            />
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand" : "Collapse"}
            <span className="ml-2 text-ink-muted">⌘B</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
