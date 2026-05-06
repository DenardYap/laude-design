"use client";

import { Input, Label, Textarea } from "@/components/ui";
import type { SkillEditFormProps } from "@/components/skills/types/skill-detail";

export function SkillEditForm({ skillId, form, onSubmit }: SkillEditFormProps) {
  return (
    <form
      id={`skill-form-${skillId}`}
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
          <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
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
  );
}
