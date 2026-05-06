import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { SkillUpdateInput } from "@/lib/validators";

export interface SkillDetailHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export interface MySkillDetailProps {
  skill: {
    id: string;
    name: string;
    description: string | null;
    content: string;
    isPublic: boolean;
    appliedByDefault: boolean;
    overrideCount: number;
    saves: number;
    likes: number;
    updatedAt: Date | string;
    /**
     * When the skill was added from the public library, points back at the
     * source so we can show provenance. `null` when the user authored it.
     */
    clonedFrom: { id: string; name: string } | null;
  };
}

export interface PublicSkillDetailProps {
  skill: {
    id: string;
    name: string;
    description: string | null;
    content: string;
    saves: number;
    likes: number;
    likedByMe: boolean;
    updatedAt: Date | string;
    authorName: string | null;
    authorImage: string | null;
    /** When the viewer already has a copy in their library, this is its id. */
    existingCopyId: string | null;
    /**
     * If this public skill was itself cloned from another *still-public* skill,
     * the source's id and name. Set to null when the original is deleted or
     * has been made private.
     */
    clonedFrom: { id: string; name: string } | null;
  };
}

export interface CreatorCardProps {
  name: string | null;
  image: string | null;
  saves: number;
  description: string | null;
}

export interface PublicSkillActionsProps {
  skillId: string;
  initialLiked: boolean;
  initialLikes: number;
  existingCopyId: string | null;
}

export interface ClonedFromBannerProps {
  clonedFrom: { id: string; name: string };
}

export interface SkillDangerActionsProps {
  skill: { id: string; name: string; overrideCount: number };
}

export interface SkillEditFormProps {
  skillId: string;
  form: UseFormReturn<SkillUpdateInput>;
  onSubmit: (values: SkillUpdateInput) => void;
}
