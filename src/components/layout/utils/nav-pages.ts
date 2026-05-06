import { FolderKanban, KeyRound, Wand2 } from "lucide-react";

import type { NavPage } from "@/components/layout/types/layout";

/**
 * Pages that appear in the global command palette's "Go to" group.
 */
export const NAV_PAGES: NavPage[] = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/api-keys", label: "Configure API keys", icon: KeyRound },
  { href: "/skills", label: "Skills", icon: Wand2 },
];

const HREF_TO_PAGE = new Map(NAV_PAGES.map((p) => [p.href, p]));

export function getNavPage(href: string): NavPage | undefined {
  return HREF_TO_PAGE.get(href);
}
