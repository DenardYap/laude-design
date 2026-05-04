"use client";

import { Pill, Switch } from "@/components/ui";
import type { SkillRowProps } from "@/components/workspace/skills/types/skills";

export function SkillRow({ skill, pending, onToggle }: SkillRowProps) {
  const isOverridden = skill.overrideApplied !== null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 hover:bg-surface-sunken">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{skill.name}</span>
          {isOverridden ? (
            <Pill tone="warning" className="shrink-0">
              Overridden
            </Pill>
          ) : null}
        </div>
        {skill.description ? (
          <p className="line-clamp-1 text-xs text-ink-muted">{skill.description}</p>
        ) : null}
      </div>
      <Switch
        checked={skill.effective}
        disabled={pending}
        onCheckedChange={onToggle}
        aria-label={`Toggle ${skill.name} for this project`}
      />
    </div>
  );
}
