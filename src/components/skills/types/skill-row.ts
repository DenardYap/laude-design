import type { ReactNode } from "react";

export interface RowFrameProps {
  href: string;
  ariaLabel: string;
  zebra: boolean;
  children: ReactNode;
  /** Number of grid columns this row spans (must match the parent grid). */
  colSpan: number;
}

export interface MineSkillRowProps {
  skill: import("./skills").MineSkill;
  zebra: boolean;
}

export interface PublicSkillRowProps {
  skill: import("./skills").PublicSkill;
  zebra: boolean;
}

export interface SkillTableHeaderProps {
  columns: ReactNode[];
  colSpan: number;
}

export interface NameCellProps {
  name: string;
  description: string | null;
}

export interface MetaCellProps {
  children: ReactNode;
  className?: string;
}
