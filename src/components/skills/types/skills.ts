export type SkillSizeBucket = "small" | "medium" | "large";

export interface BaseSkill {
  id: string;
  name: string;
  description: string | null;
  charCount: number;
  updatedAt: Date | string;
}

export interface MineSkill extends BaseSkill {
  isPublic: boolean;
  appliedByDefault: boolean;
  /** True when the skill was cloned from someone else's public skill. */
  isClone: boolean;
  /** Original creator's display name when `isClone`; null for self-authored. */
  authorName: string | null;
}

export interface PublicSkill extends BaseSkill {
  authorName: string | null;
  isMine: boolean;
  saves: number;
  likes: number;
}

export interface OwnerSkill {
  id: string;
  name: string;
  isPublic: boolean;
  appliedByDefault: boolean;
  overrideCount: number;
}
