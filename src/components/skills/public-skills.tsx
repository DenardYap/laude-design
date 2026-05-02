"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Heart } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  FramesMark,
} from "@/components/ui";
import { useScopeFilters } from "@/stores/filters-store";
import { cn, formatRelativeTime, formatSkillSize } from "@/lib/utils";
import { downloadPublicSkill, toggleSkillLike } from "@/server/actions/skills";
import { SkillUploader } from "./skill-uploader";

export interface PublicSkillItem {
  id: string;
  name: string;
  description: string | null;
  charCount: number;
  downloads: number;
  likes: number;
  likedByMe: boolean;
  updatedAt: Date | string;
  authorName: string | null;
}

interface LikeState {
  liked: boolean;
  count: number;
  pending: boolean;
}

export function PublicSkills({ skills }: { skills: PublicSkillItem[] }) {
  const router = useRouter();
  const { query } = useScopeFilters("skills:public");

  const [likeState, setLikeState] = React.useState<Record<string, LikeState>>(() =>
    Object.fromEntries(
      skills.map((s) => [s.id, { liked: s.likedByMe, count: s.likes, pending: false }]),
    ),
  );

  React.useEffect(() => {
    setLikeState((prev) =>
      Object.fromEntries(
        skills.map((s) => {
          const existing = prev[s.id];
          if (existing && existing.pending) return [s.id, existing];
          return [s.id, { liked: s.likedByMe, count: s.likes, pending: false }];
        }),
      ),
    );
  }, [skills]);

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

  async function handleToggleLike(id: string) {
    const current = likeState[id];
    if (!current || current.pending) return;
    const optimisticLiked = !current.liked;
    const optimisticCount = Math.max(0, current.count + (optimisticLiked ? 1 : -1));
    setLikeState((prev) => ({
      ...prev,
      [id]: { liked: optimisticLiked, count: optimisticCount, pending: true },
    }));
    try {
      const result = await toggleSkillLike(id);
      setLikeState((prev) => ({
        ...prev,
        [id]: { liked: result.liked, count: result.likes, pending: false },
      }));
    } catch (e) {
      setLikeState((prev) => ({
        ...prev,
        [id]: { ...current, pending: false },
      }));
      toast.error(e instanceof Error ? e.message : "Failed to update like");
    }
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={<FramesMark className="size-10" />}
        title="No public skills yet"
        description="Skills shared publicly help others get a head start. Upload a Skill and toggle it public to be the first."
        action={<SkillUploader />}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map((s) => {
        const like = likeState[s.id] ?? {
          liked: s.likedByMe,
          count: s.likes,
          pending: false,
        };
        return (
          <Card key={s.id}>
            <CardContent className="space-y-3 p-5">
              <div className="space-y-1">
                <h3 className="truncate text-base font-semibold text-ink">{s.name}</h3>
                {s.description ? (
                  <p className="line-clamp-2 text-xs text-ink-muted">{s.description}</p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                <span className="truncate">by {s.authorName ?? "anonymous"}</span>
                <span className="shrink-0">
                  {formatRelativeTime(s.updatedAt)} · {formatSkillSize(s.charCount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <Download className="size-3.5" />
                    <span className="font-medium text-ink">{s.downloads}</span>
                    <span>{s.downloads === 1 ? "use" : "uses"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart
                      className={cn(
                        "size-3.5",
                        like.liked && "fill-destructive text-destructive",
                      )}
                    />
                    <span className="font-medium text-ink">{like.count}</span>
                    <span>{like.count === 1 ? "like" : "likes"}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={like.liked ? "secondary" : "ghost"}
                    onClick={() => handleToggleLike(s.id)}
                    disabled={like.pending}
                    aria-pressed={like.liked}
                    aria-label={like.liked ? `Unlike ${s.name}` : `Like ${s.name}`}
                  >
                    <Heart
                      className={cn(
                        "size-4 transition-colors",
                        like.liked && "fill-destructive text-destructive",
                      )}
                    />
                    {like.liked ? "Liked" : "Like"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(s.id)}>
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
