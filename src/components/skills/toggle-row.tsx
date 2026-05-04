"use client";

import { Label, Switch } from "@/components/ui";
import type { ToggleRowProps } from "@/components/skills/types/skill-table";

export function ToggleRow({ id, label, helper, checked, onChange }: ToggleRowProps) {
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
