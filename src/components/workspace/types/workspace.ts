import type { ReactNode } from "react";

import type {
  ChatSessionDTO,
  DesignDTO,
  FolderDTO,
} from "@/lib/workspace/types";

export type WorkspaceUser = { name: string | null; email: string | null; image: string | null };

export interface WorkspaceHeaderProps {
  projectId: string;
  projectName: string;
  user: WorkspaceUser;
}

export interface WorkspaceHeaderNavProps {
  projectId: string;
  projectName: string;
}

export interface WorkspaceHeaderActionsProps {
  user: WorkspaceUser;
  onSkillsOpen: () => void;
}

export interface ProjectTitleProps {
  projectId: string;
  projectName: string;
}

/**
 * Which surface fills the screen on mobile. The desktop layout shows both
 * panes side-by-side via the resizable group, so this only matters below
 * the `md` breakpoint.
 */
export type MobileView = "chat" | "canvas";

export interface ProjectWorkspaceProps {
  project: { id: string; name: string };
  sessions: ChatSessionDTO[];
  folders: FolderDTO[];
  designs: DesignDTO[];
  user: WorkspaceUser;
  allProjects: { id: string; name: string }[];
  /**
   * Server-side guess at whether the request is from a desktop-class
   * device, sourced from `getServerViewport()`. Used as the SSR/hydration
   * default for `useIsDesktop` so desktop refreshes don't flash the
   * mobile tab switcher for a frame before hydration corrects it.
   */
  ssrIsDesktop: boolean;
}

export interface DesktopLayoutProps {
  projectId: string;
  sessionsPane: ReactNode;
  canvasHeader: ReactNode;
  chatBody: ReactNode;
  canvasBody: ReactNode;
}

export interface MobileLayoutProps {
  mobileView: MobileView;
  onChangeView: (view: MobileView) => void;
  chatPane: ReactNode;
  canvasPane: ReactNode;
}

export interface MobileViewSwitcherProps {
  value: MobileView;
  onChange: (view: MobileView) => void;
}
