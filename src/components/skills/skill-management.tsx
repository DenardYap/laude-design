"use client";

import { useState } from 'react';
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button, ConfirmDialog, Label, Switch } from "@/components/ui";
import {
  clearSkillOverrides,
  deleteSkill,
  setSkillAppliedByDefault,
  toggleSkillPublic,
} from "@/server/actions/skills";

interface OwnerSkill {
  id: string;
  name: string;
  isPublic: boolean;
  appliedByDefault: boolean;
  overrideCount: number;
}

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

/**
 * Owner-only destructive actions, rendered below the sharing panel rather
 * than inside it. Keeping these outside the shared card prevents the
 * sidebar from growing taller than the editor and makes Delete feel like a
 * deliberate, separate decision (not a sibling of "make public").
 */
export function SkillDangerActions({
  skill,
}: {
  skill: { id: string; name: string; overrideCount: number };
}) {
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

interface ToggleRowProps {
  id: string;
  label: string;
  helper: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ id, label, helper, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </Label>
        <p className="text-xs text-ink-muted">{helper}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
