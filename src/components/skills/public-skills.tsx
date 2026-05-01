"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Globe } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useScopeFilters } from "@/stores/filters-store";
import { formatRelativeTime } from "@/lib/utils";
import { downloadPublicSkill } from "@/server/actions/skills";

export interface PublicSkillItem {
  id: string;
  name: string;
  description: string | null;
  downloads: number;
  updatedAt: Date | string;
  authorName: string | null;
}

export function PublicSkills({ skills }: { skills: PublicSkillItem[] }) {
  const router = useRouter();
  const { query } = useScopeFilters("skills:public");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description?.toLowerCase().includes(q) ?? false) ||
        (s.authorName?.toLowerCase().includes(q) ?? false),
    );
  }, [skills, query]);

  async function handleDownload(id: string) {
    try {
      const { filename, content } = await downloadPublicSkill(id);
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download");
    }
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<Globe className="size-10" />}
        title="No public skills yet"
        description="Be the first — upload a Skill and toggle it public."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map((s) => (
        <Card key={s.id}>
          <CardContent className="space-y-3 p-5">
            <div className="space-y-1">
              <h3 className="truncate text-base font-semibold">{s.name}</h3>
              {s.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>by {s.authorName ?? "anonymous"}</span>
              <span>
                {s.downloads} downloads · {formatRelativeTime(s.updatedAt)}
              </span>
            </div>
            <div className="flex justify-end border-t border-border pt-3">
              <Button size="sm" variant="outline" onClick={() => handleDownload(s.id)}>
                <Download className="size-4" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
