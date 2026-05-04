"use client";

import { useMemo } from 'react';
import { useRouter, usePathname } from "next/navigation";
import { FolderKanban } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui";
import { useUiStore } from "@/stores/ui-store";
import { useRecentsStore, type RecentItem } from "@/stores/recents-store";
import { NAV_PAGES, getNavPage } from "@/components/layout/nav-pages";

const MAX_RECENTS = 5;

interface GlobalCommandPaletteProps {
  /** All of the user's projects, freshest first. Passed in from the server
   * layout so the palette doesn't need its own client-side fetch. */
  projects: { id: string; name: string }[];
}

/** A row in the "Recently used" group, normalized for rendering. */
type RecentRow =
  | { kind: "project"; key: string; href: string; label: string }
  | { kind: "page"; key: string; href: string; label: string };

export function GlobalCommandPalette({ projects }: GlobalCommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const recents = useRecentsStore((s) => s.recents);

  const knownProjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  // Resolve raw recents → display rows. Stale entries (deleted projects,
  // pages no longer in NAV_PAGES) are filtered out so the palette never
  // shows broken links. Capped at 5 — older history stays in the store but
  // doesn't surface here.
  const recentRows = useMemo<RecentRow[]>(() => {
    const rows: RecentRow[] = [];
    for (const r of recents) {
      const row = resolveRecent(r, knownProjects);
      if (row) rows.push(row);
      if (rows.length >= MAX_RECENTS) break;
    }
    return rows;
  }, [recents, knownProjects]);

  // Hide projects/pages that already appear in "Recently used" so the same
  // entry doesn't show up twice in the same palette view.
  const recentKeys = useMemo(
    () => new Set(recentRows.map((r) => r.key)),
    [recentRows],
  );

  const otherProjects = useMemo(
    () => projects.filter((p) => !recentKeys.has(`project:${p.id}`)),
    [projects, recentKeys],
  );

  const otherPages = useMemo(
    () => NAV_PAGES.filter((p) => !recentKeys.has(`page:${p.href}`)),
    [recentKeys],
  );

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden p-0"
        showDefaultClose={false}
        aria-describedby={undefined}
      >
        {/* Visually hidden title — Radix requires a DialogTitle for a11y but
            the CommandInput acts as the visible heading. */}
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command label="Command palette">
          <CommandInput placeholder="Search pages and projects..." autoFocus />
          <CommandList>
            <CommandEmpty>No matches</CommandEmpty>

            {recentRows.length > 0 ? (
              <CommandGroup heading="Recently used">
                {recentRows.map((row) => (
                  <RecentCommandItem
                    key={row.key}
                    row={row}
                    onSelect={() => go(row.href)}
                  />
                ))}
              </CommandGroup>
            ) : null}

            {otherProjects.length > 0 ? (
              <CommandGroup heading="Projects">
                {otherProjects.map((p) => (
                  <CommandItem
                    key={`project-${p.id}`}
                    value={`project ${p.name}`}
                    onSelect={() => go(`/projects/${p.id}`)}
                  >
                    <FolderKanban className="mr-2 size-3.5 text-ink-subtle" />
                    <span className="truncate">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {otherPages.length > 0 ? (
              <CommandGroup heading="Go to">
                {otherPages.map(({ href, label, icon: Icon }) => {
                  const isCurrent =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <CommandItem
                      key={href}
                      value={`page ${label}`}
                      onSelect={() => go(href)}
                    >
                      <Icon className="mr-2 size-3.5 text-ink-subtle" />
                      <span className="truncate">{label}</span>
                      {isCurrent ? (
                        <span className="ml-auto text-[10px] text-ink-muted">
                          current
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Convert a raw `RecentItem` into a render-ready `RecentRow`, dropping it if
 * the underlying target no longer exists (deleted project, removed page).
 */
function resolveRecent(
  item: RecentItem,
  knownProjects: Map<string, string>,
): RecentRow | null {
  if (item.kind === "project") {
    const liveName = knownProjects.get(item.id);
    if (!liveName) return null;
    return {
      kind: "project",
      key: `project:${item.id}`,
      href: `/projects/${item.id}`,
      label: liveName,
    };
  }
  const page = getNavPage(item.href);
  if (!page) return null;
  return {
    kind: "page",
    key: `page:${page.href}`,
    href: page.href,
    label: page.label,
  };
}

interface RecentCommandItemProps {
  row: RecentRow;
  onSelect: () => void;
}

function RecentCommandItem({ row, onSelect }: RecentCommandItemProps) {
  // Use the entry's native icon (the project folder, or the page's own icon)
  // so the user can scan the list visually and still tell which type each
  // row is — the "Recently used" heading alone doesn't communicate that.
  const Icon =
    row.kind === "project" ? FolderKanban : (getNavPage(row.href)?.icon ?? FolderKanban);

  return (
    <CommandItem
      value={`recent ${row.label}`}
      onSelect={onSelect}
    >
      <Icon className="mr-2 size-3.5 text-ink-subtle" />
      <span className="truncate">{row.label}</span>
    </CommandItem>
  );
}
