"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";

import { Button, Pill } from "@/components/ui";
import { SkillUpdateSchema, type SkillUpdateInput } from "@/lib/validators";
import { updateSkill } from "@/server/actions/skills";
import { formatRelativeTime, formatSkillSize } from "@/lib/utils";
import { SkillDetailHeader } from "@/components/skills/skill-detail-header";
import { SkillSharingPanel, SkillDangerActions } from "@/components/skills/skill-management";
import { SkillEditForm } from "@/components/skills/skill-edit-form";
import { SkillClonedFromBanner } from "@/components/skills/skill-cloned-from-banner";
import type { MySkillDetailProps } from "@/components/skills/types/skill-detail";

export function MySkillDetail({ skill }: MySkillDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<SkillUpdateInput>({
    resolver: zodResolver(SkillUpdateSchema),
    defaultValues: {
      name: skill.name,
      description: skill.description ?? "",
      content: skill.content,
    },
  });

  useEffect(() => {
    form.reset({
      name: skill.name,
      description: skill.description ?? "",
      content: skill.content,
    });
  }, [skill.id, skill.name, skill.description, skill.content, form]);

  const watchedContent = form.watch("content");
  const charCount = watchedContent?.length ?? 0;

  function onSubmit(values: SkillUpdateInput) {
    startTransition(async () => {
      try {
        await updateSkill(skill.id, values);
        toast.success("Skill saved");
        form.reset(values);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-6">
      <SkillDetailHeader
        title={skill.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
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
            <span>Updated {formatRelativeTime(skill.updatedAt)}</span>
            <span aria-hidden>·</span>
            <span>{formatSkillSize(charCount)}</span>
          </span>
        }
        actions={
          <Button
            type="submit"
            form={`skill-form-${skill.id}`}
            disabled={pending || !form.formState.isDirty}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        }
      />

      {skill.clonedFrom ? <SkillClonedFromBanner originalId={skill.clonedFrom.id} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <SkillEditForm skillId={skill.id} form={form} onSubmit={onSubmit} />

        <div className="space-y-3">
          <SkillSharingPanel
            skill={{
              id: skill.id,
              name: skill.name,
              isPublic: skill.isPublic,
              appliedByDefault: skill.appliedByDefault,
              overrideCount: skill.overrideCount,
            }}
          />
          <SkillDangerActions
            skill={{
              id: skill.id,
              name: skill.name,
              overrideCount: skill.overrideCount,
            }}
          />
        </div>
      </div>
    </div>
  );
}
