"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsLeft,
  ChevronsRight,
  FolderKanban,
  KeyRound,
  Wand2,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiStore } from "@/stores/ui-store";
import { cn, getInitials } from "@/lib/utils";

interface AppSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    workspaceName?: string | null;
  };
}

const navItems = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/api-keys", label: "Configure API", icon: KeyRound },
  { href: "/skills", label: "Skills", icon: Wand2 },
];

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const initials = getInitials(user.name, user.email);
  const workspaceLabel = user.workspaceName || `${user.name?.split(" ")[0] ?? "Your"}'s workspace`;

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex items-center gap-2 px-3 py-3", collapsed ? "flex-col" : "justify-between")}>
        {collapsed ? (
          <>
            <Link href="/projects" className="flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Laude Design"
                width={36}
                height={36}
                className="size-9 shrink-0"
                priority
              />
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Link href="/projects" className="flex items-center gap-2 px-1">
              <Image
                src="/logo.png"
                alt="Laude Design"
                width={36}
                height={36}
                className="size-9 shrink-0"
                priority
              />
              <span className="text-sm font-semibold tracking-tight">Laude Design</span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Collapse</TooltipContent>
            </Tooltip>
          </>
        )}
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
                    "group flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-2" : "gap-3 px-2",
                    active
                      ? "bg-primary/40 text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed ? (
                    <span
                      className={cn(
                        "truncate",
                        active && "underline decoration-foreground/30 underline-offset-4",
                      )}
                    >
                      {label}
                    </span>
                  ) : null}
                </Link>
              </TooltipTrigger>
              {collapsed ? <TooltipContent side="right">{label}</TooltipContent> : null}
            </Tooltip>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <Avatar className="size-9">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? ""} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">{workspaceLabel}</div>
              <div className="truncate text-xs text-muted-foreground">workspace</div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
