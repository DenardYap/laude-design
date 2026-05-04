import type { LucideIcon } from "lucide-react";

export interface NavPage {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface GlobalCommandPaletteProps {
  /** All of the user's projects, freshest first. Passed in from the server
   * layout so the palette doesn't need its own client-side fetch. */
  projects: { id: string; name: string }[];
}

/** A row in the "Recently used" group, normalized for rendering. */
export type RecentRow =
  | { kind: "project"; key: string; href: string; label: string }
  | { kind: "page"; key: string; href: string; label: string };

export interface RecentCommandItemProps {
  row: RecentRow;
  onSelect: () => void;
}

export interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  /** All of the user's projects, freshest first. Powers the command palette's
   * "Projects" and "Recently used" groups. */
  projects: { id: string; name: string }[];
}

export interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  size?: "sm" | "md";
}

export interface SidebarBodyProps {
  pathname: string;
  collapsed: boolean;
  showCollapseToggle: boolean;
  onToggleCollapse: () => void;
}
