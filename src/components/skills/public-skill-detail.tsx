"use client";

import { Pill } from "@/components/ui";
import { formatRelativeTime, formatSkillSize } from "@/lib/utils";
import { SkillDetailHeader } from "@/components/skills/skill-detail-header";
import { ClonedFromBanner } from "@/components/skills/cloned-from-banner";
import { CreatorCard } from "@/components/skills/creator-card";
import { PublicSkillActions } from "@/components/skills/public-skill-actions";
import { SkillContentPreview } from "@/components/skills/skill-content-preview";
import type { PublicSkillDetailProps } from "@/components/skills/types/skill-detail";

export function PublicSkillDetail({ skill }: PublicSkillDetailProps) {
  return (
    <div className="space-y-6">
      <SkillDetailHeader
        title={skill.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Pill tone="success" className="h-5 px-1.5 py-0 text-[10px]">
              Public
            </Pill>
            <span>Updated {formatRelativeTime(skill.updatedAt)}</span>
            <span aria-hidden>·</span>
            <span>{formatSkillSize(skill.content.length)}</span>
          </span>
        }
        actions={
          <PublicSkillActions
            skillId={skill.id}
            initialLiked={skill.likedByMe}
            initialLikes={skill.likes}
            existingCopyId={skill.existingCopyId}
          />
        }
      />

      {/* Give original author credit */}
      {skill.clonedFrom ? <ClonedFromBanner clonedFrom={skill.clonedFrom} /> : null}

      <CreatorCard
        name={skill.authorName}
        image={skill.authorImage}
        saves={skill.saves}
        description={skill.description}
      />

      <SkillContentPreview name={skill.name} content={skill.content} />
    </div>
  );
}
