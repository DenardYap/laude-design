"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useScopeFilters } from "@/stores/filters-store";
import { formatRelativeTime } from "@/lib/utils";
import { deleteSkill, toggleSkillPublic } from "@/server/actions/skills";

export interface MySkillItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  downloads: number;
  updatedAt: Date | string;
}

export function MySkills({ skills }: { skills: MySkillItem[] }) {
  const router = useRouter();
  const { query } = useScopeFilters("skills:mine");
  const [pendingDelete, setPendingDelete] = React.useState<MySkillItem | null>(null);

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
        icon={<Lock className="size-10" />}
        title="No skills yet"
        description="Upload a markdown or text file to teach the agent something new."
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{s.name}</h3>
                  {s.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                  ) : null}
                </div>
                {s.isPublic ? (
                  <Badge variant="success" className="gap-1">
                    <Globe className="size-3" />
                    Public
                  </Badge>
                ) : (
                  <Badge variant="muted" className="gap-1">
                    <Lock className="size-3" />
                    Private
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatRelativeTime(s.updatedAt)}</span>
                {s.isPublic ? <span>{s.downloads} downloads</span> : null}
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
                  <label htmlFor={`pub-${s.id}`} className="text-xs text-muted-foreground">
                    Public
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => setPendingDelete(s)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete skill?"
        description={pendingDelete ? `"${pendingDelete.name}" will be removed.` : ""}
        confirmLabel="Delete"
        variant="destructive"
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
    </>
  );
}
