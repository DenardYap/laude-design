"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BookmarkPlus,
  Heart,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addPublicSkillToLibrary, toggleSkillLike } from "@/server/actions/skills";
import type { PublicSkillActionsProps } from "@/components/skills/types/skill-detail";

export function PublicSkillActions({
  skillId,
  initialLiked,
  initialLikes,
  existingCopyId,
}: PublicSkillActionsProps) {
  const router = useRouter();
  const [like, setLike] = useState({
    liked: initialLiked,
    count: initialLikes,
    everLiked: initialLiked,
    pending: false,
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setLike((prev) =>
      prev.pending
        ? prev
        : {
            liked: initialLiked,
            count: initialLikes,
            everLiked: prev.everLiked || initialLiked,
            pending: false,
          },
    );
  }, [initialLiked, initialLikes]);

  async function handleLike() {
    if (like.pending) return;
    const nextLiked = !like.liked;
    const optimisticCount =
      nextLiked && !like.everLiked ? like.count + 1 : like.count;
    setLike((prev) => ({
      ...prev,
      liked: nextLiked,
      count: optimisticCount,
      pending: true,
    }));
    try {
      const res = await toggleSkillLike(skillId);
      setLike((prev) => ({
        liked: res.liked,
        count: res.likes,
        everLiked: prev.everLiked || res.liked,
        pending: false,
      }));
    } catch (e) {
      setLike((prev) => ({
        ...prev,
        liked: initialLiked,
        count: initialLikes,
        pending: false,
      }));
      toast.error(e instanceof Error ? e.message : "Failed to update like");
    }
  }

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await addPublicSkillToLibrary(skillId);
      toast.success(
        res.alreadyAdded
          ? "Already in your library"
          : "Added · applied to all projects",
      );
      router.push(`/skills/${res.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <Button
        variant={like.liked ? "secondary" : "outline"}
        size="md"
        onClick={handleLike}
        disabled={like.pending}
        aria-pressed={like.liked}
        aria-label={like.liked ? "Un-like this skill" : "Like this skill"}
      >
        <Heart
          className={cn(
            "size-4",
            like.liked && "fill-destructive text-destructive",
          )}
        />
        {like.count}
      </Button>
      {existingCopyId ? (
        <Button asChild variant="outline">
          <Link href={`/skills/${existingCopyId}`}>
            <ArrowUpRight className="size-4" />
            Open my copy
          </Link>
        </Button>
      ) : (
        <Button onClick={handleAdd} disabled={adding}>
          {adding ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BookmarkPlus className="size-4" />
          )}
          Add to my Skills
        </Button>
      )}
    </>
  );
}
