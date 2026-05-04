"use client";

import { Globe, Lock } from "lucide-react";

import { Pill } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import { formatTokens } from "@/components/skills/utils/skill-size";
import { RowFrame } from "@/components/skills/row-frame";
import { NameCell } from "@/components/skills/name-cell";
import { MetaCell } from "@/components/skills/meta-cell";
import type { MineSkillRowProps } from "@/components/skills/types/skill-row";

export function MineSkillRow({ skill, zebra }: MineSkillRowProps) {
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
          {skill.isClone ? (skill.authorName ?? "Anonymous user") : "you"}
        </span>
      </MetaCell>
      <MetaCell>
        {skill.isPublic ? (
          <Pill tone="success" className="h-5 px-1.5 py-0 text-[10px]">
            <Globe />
            Public
          </Pill>
        ) : (
          <Pill tone="neutral" className="h-5 px-1.5 py-0 text-[10px]">
            <Lock />
            Private
          </Pill>
        )}
      </MetaCell>
      <MetaCell>
        {skill.appliedByDefault ? (
          <Pill tone="outline" className="h-5 px-1.5 py-0 text-[10px]">
            Default
          </Pill>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </MetaCell>
      <MetaCell>{formatTokens(skill.charCount)}</MetaCell>
      <MetaCell>{formatRelativeTime(skill.updatedAt)}</MetaCell>
    </RowFrame>
  );
}
