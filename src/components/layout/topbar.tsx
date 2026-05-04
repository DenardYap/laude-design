"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Github, Menu, Search, Star } from "lucide-react";

import { Button, IconButton } from "@/components/ui";
import { UserMenu } from "@/components/layout/user-menu";
import { TopbarSearch } from "@/components/layout/topbar-search";
import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { useUiStore } from "@/stores/ui-store";
import { GITHUB_REPO, fetchStarCount, formatStarCount } from "@/components/layout/utils/github";
import type { TopbarProps } from "@/components/layout/types/layout";

export function Topbar({ user, projects }: TopbarProps) {
  const { data: starCount } = useQuery({
    queryKey: ["github-stars", GITHUB_REPO],
    queryFn: fetchStarCount,
    staleTime: 5 * 60_000,
  });

  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  // Global ⌘K / Ctrl+K shortcut. Lives in the topbar (the only place the
  // palette is mounted in the app shell) so a single listener owns it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommandPalette]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-6">
      {/* Mobile-only hamburger. The desktop sidebar is hidden below `md`,
          so this button is the sole entry point to navigation on phones. */}
      <IconButton
        aria-label="Open menu"
        className="md:hidden"
        icon={<Menu className="size-5" />}
        onClick={() => setMobileOpen(true)}
      />

      {/* Logo lockup, mobile-only. The desktop sidebar already shows it,
          so we hide on `md+`. */}
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

      <div className="flex-1" />

      <div className="hidden md:block">
        <TopbarSearch />
      </div>
      {/* Compact search affordance on mobile — single tap opens the same
          ⌘K command palette so users can still find projects by name. */}
      <IconButton
        aria-label="Search"
        className="md:hidden"
        icon={<Search className="size-5" />}
        onClick={() => setCommandPaletteOpen(true)}
      />

      <Button
        asChild
        variant="outline"
        size="sm"
        className="hidden gap-2 rounded-full px-3 sm:inline-flex"
      >
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Star on GitHub"
        >
          <Star className="size-3.5" />
          <span className="text-xs">Star</span>
          {starCount !== undefined ? (
            <span className="text-xs text-ink-muted">{formatStarCount(starCount)}</span>
          ) : null}
        </a>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="GitHub repo"
        className="hidden sm:inline-flex"
      >
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github className="size-5" />
        </a>
      </Button>

      <div className="ml-1">
        <UserMenu user={user} size="sm" />
      </div>

      <GlobalCommandPalette projects={projects} />
    </header>
  );
}
