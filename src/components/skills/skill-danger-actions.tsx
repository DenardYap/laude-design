"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, ConfirmDialog } from "@/components/ui";
import { clearSkillOverrides, deleteSkill } from "@/server/actions/skills";
import type { SkillDangerActionsProps } from "@/components/skills/types/skill-detail";

export function SkillDangerActions({ skill }: SkillDangerActionsProps) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);

  return (
    <div className="space-y-2">
      {skill.overrideCount > 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center"
          onClick={() => setPendingReset(true)}
        >
          Reset {skill.overrideCount} project override
          {skill.overrideCount === 1 ? "" : "s"}
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center text-destructive hover:bg-destructive-soft"
        onClick={() => setPendingDelete(true)}
      >
        <Trash2 className="size-4" />
        Delete skill
      </Button>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Delete skill?"
        description={`"${skill.name}" will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={async () => {
          try {
            await deleteSkill(skill.id);
            toast.success("Skill deleted");
            router.push("/skills");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />

      <ConfirmDialog
        open={pendingReset}
        onOpenChange={setPendingReset}
        title="Reset project overrides?"
        description={`Clear per-project overrides for "${skill.name}" on ${skill.overrideCount} project${skill.overrideCount === 1 ? "" : "s"}? Each will revert to the default above.`}
        confirmLabel="Reset overrides"
        tone="destructive"
        onConfirm={async () => {
          try {
            await clearSkillOverrides(skill.id);
            toast.success("Overrides cleared");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />
    </div>
  );
}
