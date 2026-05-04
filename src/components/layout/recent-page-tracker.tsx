"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { getNavPage } from "@/components/layout/utils/nav-pages";
import { useRecentsStore } from "@/stores/recents-store";

/**
 * Mounted once in the (app) layout. Records a "page" visit in the recents
 * store every time the pathname matches a known nav page so the global ⌘K
 * palette can surface it under "Recently used".
 *
 * Project visits (`/projects/[id]`) live in the (workspace) layout and are
 * tracked separately by `ProjectWorkspace` — they aren't pages, so they
 * shouldn't be confused with one here.
 */
export function RecentPageTracker() {
  const pathname = usePathname();
  const addRecent = useRecentsStore((s) => s.addRecent);

  useEffect(() => {
    if (!getNavPage(pathname)) return;
    addRecent({ kind: "page", href: pathname });
  }, [pathname, addRecent]);

  return null;
}
