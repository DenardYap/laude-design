"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  EmptyState,
  FramesMark,
  IconButton,
  Pill,
  Switch,
} from "@/components/ui";
import { useScopeFilters } from "@/stores/filters-store";
import { formatRelativeTime, formatSkillSize } from "@/lib/utils";
import {
  clearSkillOverrides,
  deleteSkill,
  setSkillAppliedByDefault,
  toggleSkillPublic,
} from "@/server/actions/skills";
import { SkillUploader } from "./skill-uploader";

export interface MySkillItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  appliedByDefault: boolean;
  overrideCount: number;
  downloads: number;
  charCount: number;
  updatedAt: Date | string;
}

export function MySkills({ skills }: { skills: MySkillItem[] }) {
  const router = useRouter();
  const { query } = useScopeFilters("skills:mine");
  const [pendingDelete, setPendingDelete] = React.useState<MySkillItem | null>(null);
  const [pendingReset, setPendingReset] = React.useState<MySkillItem | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false),
    );
  }, [skills, query]);

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<FramesMark className="size-10" />}
        title="No skills yet"
        description="Skills are markdown or text snippets the agent can use as context. Upload your first one to get started."
        action={<SkillUploader />}
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-ink">{s.name}</h3>
                  {s.description ? (
                    <p className="line-clamp-2 text-xs text-ink-muted">{s.description}</p>
                  ) : null}
                </div>
                {s.isPublic ? (
                  <Pill tone="success">
                    <Globe />
                    Public
                  </Pill>
                ) : (
                  <Pill tone="neutral">
                    <Lock />
                    Private
                  </Pill>
                )}
              </div>

              <div className="space-y-1 rounded-md border border-border bg-surface-sunken p-3">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`apply-${s.id}`}
                    className="text-sm font-medium text-ink"
                  >
                    Apply to every project by default
                  </label>
                  <Switch
                    id={`apply-${s.id}`}
                    checked={s.appliedByDefault}
                    onCheckedChange={async (v) => {
                      try {
                        await setSkillAppliedByDefault(s.id, v);
                        toast.success(
                          v ? "Skill applied to all projects by default" : "Skill paused",
                        );
                        router.refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  />
                </div>
                {s.overrideCount > 0 ? (
                  <p className="text-xs text-ink-muted">
                    {s.overrideCount} project{s.overrideCount === 1 ? "" : "s"} override
                    this —{" "}
                    <button
                      onClick={() => setPendingReset(s)}
                      className="font-medium text-ink underline-offset-2 hover:underline"
                    >
                      Reset
                    </button>
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                <span className="truncate">
                  Updated {formatRelativeTime(s.updatedAt)} · {formatSkillSize(s.charCount)}
                </span>
                {s.isPublic ? (
                  <span className="shrink-0">{s.downloads} downloads</span>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`pub-${s.id}`}
                    checked={s.isPublic}
                    onCheckedChange={async (v) => {
                      try {
                        await toggleSkillPublic(s.id, v);
                        toast.success(v ? "Skill made public" : "Skill made private");
                        router.refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  />
                  <label htmlFor={`pub-${s.id}`} className="text-xs text-ink-muted">
                    Public
                  </label>
                </div>
                <IconButton
                  aria-label={`Delete ${s.name}`}
                  onClick={() => setPendingDelete(s)}
                  icon={<Trash2 className="size-4 text-destructive" />}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete skill?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" will be removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteSkill(pendingDelete.id);
            toast.success("Skill deleted");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />

      <ConfirmDialog
        open={!!pendingReset}
        onOpenChange={(open) => !open && setPendingReset(null)}
        title="Reset project overrides?"
        description={
          pendingReset
            ? `Remove the per-project overrides for "${pendingReset.name}" on ${pendingReset.overrideCount} project${pendingReset.overrideCount === 1 ? "" : "s"}? Each will revert to the default above.`
            : ""
        }
        confirmLabel="Reset overrides"
        tone="destructive"
        onConfirm={async () => {
          if (!pendingReset) return;
          try {
            await clearSkillOverrides(pendingReset.id);
            toast.success("Overrides cleared");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />
    </>
  );
}
