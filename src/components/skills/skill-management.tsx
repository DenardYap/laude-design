"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setSkillAppliedByDefault, toggleSkillPublic } from "@/server/actions/skills";
import { ToggleRow } from "@/components/skills/toggle-row";
import type { OwnerSkill } from "@/components/skills/types/skills";

export { SkillDangerActions } from "@/components/skills/skill-danger-actions";

/**
 * Owner-only sharing panel: visibility + default-apply toggles only. Lives in
 * the right sidebar of the skill detail page. Destructive actions are
 * deliberately outside this card — see `SkillDangerActions`.
 */
export function SkillSharingPanel({ skill }: { skill: OwnerSkill }) {
  const router = useRouter();

  return (
    <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
      <ToggleRow
        id={`apply-${skill.id}`}
        label="Apply to every project by default"
        helper={
          skill.overrideCount > 0
            ? `${skill.overrideCount} project${skill.overrideCount === 1 ? "" : "s"} override this.`
            : "New projects inherit this setting."
        }
        checked={skill.appliedByDefault}
        onChange={async (v) => {
          try {
            await setSkillAppliedByDefault(skill.id, v);
            toast.success(v ? "Applied by default" : "Default off");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />

      <ToggleRow
        id={`public-${skill.id}`}
        label="Public"
        helper="Anyone signed in can view, like, and download this skill."
        checked={skill.isPublic}
        onChange={async (v) => {
          try {
            await toggleSkillPublic(skill.id, v);
            toast.success(v ? "Skill is now public" : "Skill is now private");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />
    </aside>
  );
}
