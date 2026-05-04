"use client";

import { useEffect, useTransition } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Globe, Loader2, Lock, Save } from "lucide-react";
import { toast } from "sonner";

import { Button, Input, Label, Pill, Textarea } from "@/components/ui";
import { SkillUpdateSchema, type SkillUpdateInput } from "@/lib/validators";
import { updateSkill } from "@/server/actions/skills";
import { formatRelativeTime, formatSkillSize } from "@/lib/utils";
import { SkillDetailHeader } from "./skill-detail-header";
import { SkillDangerActions, SkillSharingPanel } from "./skill-management";

interface MySkillDetailProps {
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

  // Reset the form whenever a fresh server-rendered skill arrives (e.g. after
  // a router.refresh() following another action). Without this the form would
  // keep stale "dirty" state and the Save button would mis-render.
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

      {skill.clonedFrom ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-sunken/40 px-3 py-2 text-xs text-ink-muted">
          <span>
            Added from the public library — your copy is independent of the original.
          </span>
          <Link
            href={`/skills/${skill.clonedFrom.id}`}
            className="inline-flex items-center gap-1 font-medium text-ink hover:underline"
          >
            View original
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form
          id={`skill-form-${skill.id}`}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="skill-name">Name</Label>
            <Input id="skill-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-description">
              Description <span className="text-ink-subtle">(optional)</span>
            </Label>
            <Input
              id="skill-description"
              placeholder="What this skill teaches the agent"
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="skill-content">Content</Label>
            <Textarea
              id="skill-content"
              rows={22}
              className="font-mono text-xs leading-relaxed"
              spellCheck={false}
              {...form.register("content")}
            />
            {form.formState.errors.content ? (
              <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
            ) : null}
          </div>
        </form>

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
