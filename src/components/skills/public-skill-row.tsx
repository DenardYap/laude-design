"use client";

import { Bookmark, Heart } from "lucide-react";

import { formatRelativeTime } from "@/lib/utils";
import { formatTokens } from "@/components/skills/utils/skill-size";
import { RowFrame } from "@/components/skills/row-frame";
import { NameCell } from "@/components/skills/name-cell";
import { MetaCell } from "@/components/skills/meta-cell";
import type { PublicSkillRowProps } from "@/components/skills/types/skill-row";

export function PublicSkillRow({ skill, zebra }: PublicSkillRowProps) {
  return (
    <RowFrame
      href={`/skills/${skill.id}`}
      ariaLabel={`Open ${skill.name}`}
      zebra={zebra}
      colSpan={6}
    >
      <NameCell name={skill.name} description={skill.description} />
      <MetaCell>
        <span className="truncate">
          by {skill.isMine ? "you" : (skill.authorName ?? "anonymous")}
        </span>
      </MetaCell>
      <MetaCell>
        <Bookmark className="size-3.5 text-ink-subtle" />
        <span className="ml-1">{skill.saves}</span>
      </MetaCell>
      <MetaCell>
        <Heart className="size-3.5 text-ink-subtle" />
        <span className="ml-1">{skill.likes}</span>
      </MetaCell>
      <MetaCell>{formatTokens(skill.charCount)}</MetaCell>
      <MetaCell>{formatRelativeTime(skill.updatedAt)}</MetaCell>
    </RowFrame>
  );
}
