import type { LucideIcon } from "lucide-react";

export interface NavPage {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface GlobalCommandPaletteProps {
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
  projects: { id: string; name: string }[];
  starCount?: number;
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

export type SidebarMobileProps = {
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type SidebarCollapseToggleProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export type SidebarDesktopProps = {
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export type SidebarLogoProps = {
  collapsed: boolean;
};

export type SidebarNavProps = {
  pathname: string;
  collapsed: boolean;
};

export type TopbarGithubButtonsProps = {
  starCount: number | undefined;
};

export type TopbarMobileNavProps = {
  onMenuOpen: () => void;
};

export type TopbarSearchControlsProps = {
  onOpenCommandPalette: () => void;
};
