"use client";

import { useEffect, useState } from 'react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkPlus,
  Heart,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Pill,
} from "@/components/ui";
import {
  cn,
  formatRelativeTime,
  formatSkillSize,
  getInitials,
} from "@/lib/utils";
import { addPublicSkillToLibrary, toggleSkillLike } from "@/server/actions/skills";
import { SkillDetailHeader } from "./skill-detail-header";

interface PublicSkillDetailProps {
  skill: {
    id: string;
    name: string;
    description: string | null;
    content: string;
    saves: number;
    likes: number;
    likedByMe: boolean;
    updatedAt: Date | string;
    authorName: string | null;
    authorImage: string | null;
    /** When the viewer already has a copy in their library, this is its id. */
    existingCopyId: string | null;
    /**
     * If this public skill was itself cloned from another *still-public* skill,
     * the source's id and name. Set to null when the original is deleted or
     * has been made private — both of which would make the link unreachable.
     */
    clonedFrom: { id: string; name: string } | null;
  };
}

/**
 * Read-only viewer for a public skill that the current user does not own.
 * Owners are routed to MySkillDetail upstream, so this component never needs
 * to handle edit / delete / public-toggle controls. Mutating actions here:
 *  - toggle the personal liked state (counter is monotonic per user — see
 *    `toggleSkillLike` server action),
 *  - one-shot "Add to my Skills" clone (idempotent on the existing-clone check).
 */
export function PublicSkillDetail({ skill }: PublicSkillDetailProps) {
  return (
    <div className="space-y-6">
      <SkillDetailHeader
        title={skill.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <Pill tone="success" className="h-5 px-1.5 py-0 text-[10px]">
              Public
            </Pill>
            <span>Updated {formatRelativeTime(skill.updatedAt)}</span>
            <span aria-hidden>·</span>
            <span>{formatSkillSize(skill.content.length)}</span>
          </span>
        }
        actions={
          <PublicSkillActions
            skillId={skill.id}
            initialLiked={skill.likedByMe}
            initialLikes={skill.likes}
            existingCopyId={skill.existingCopyId}
          />
        }
      />

      {skill.clonedFrom ? <ClonedFromBanner clonedFrom={skill.clonedFrom} /> : null}

      <CreatorCard
        name={skill.authorName}
        image={skill.authorImage}
        saves={skill.saves}
        description={skill.description}
      />

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2 text-xs text-ink-muted">
          <span className="font-mono">{skill.name}</span>
        </div>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-ink">
          {skill.content}
        </pre>
      </div>
    </div>
  );
}

function ClonedFromBanner({ clonedFrom }: { clonedFrom: { id: string; name: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-sunken/50 px-3 py-2 text-xs text-ink-muted">
      <ArrowUpRight className="size-3.5 shrink-0" />
      <span>
        Cloned from{" "}
        <Link
          href={`/skills/${clonedFrom.id}`}
          className="font-medium text-ink underline-offset-2 hover:underline"
        >
          {clonedFrom.name}
        </Link>
      </span>
    </div>
  );
}

interface CreatorCardProps {
  name: string | null;
  image: string | null;
  saves: number;
  description: string | null;
}

function CreatorCard({ name, image, saves, description }: CreatorCardProps) {
  const displayName = name ?? "Anonymous user";
  return (
    <div className="flex items-start gap-3">
      <Avatar className="size-10">
        {image ? <AvatarImage src={image} alt={displayName} /> : null}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium text-ink">{displayName}</span>
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            shared · <Bookmark className="size-3" /> saved by {saves}
          </span>
        </div>
        {description ? (
          <p className="text-xs text-ink-muted">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

interface PublicSkillActionsProps {
  skillId: string;
  initialLiked: boolean;
  initialLikes: number;
  existingCopyId: string | null;
}

function PublicSkillActions({
  skillId,
  initialLiked,
  initialLikes,
  existingCopyId,
}: PublicSkillActionsProps) {
  const router = useRouter();
  // The personal liked flag toggles freely; the public counter is monotonic
  // server-side, so the optimistic +1 only fires on the user's first-ever
  // like (when they had no SkillLike row before).
  const [like, setLike] = useState({
    liked: initialLiked,
    count: initialLikes,
    /** Mirrors the server's "has this user ever liked" state. */
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
            // If the server says they're liked, they have necessarily ever
            // liked. The reverse isn't true (initialLiked=false could mean
            // either "never liked" or "previously liked, now un-liked") but
            // we don't need to disambiguate optimistically — the server
            // returns the authoritative count after each toggle.
            everLiked: prev.everLiked || initialLiked,
            pending: false,
          },
    );
  }, [initialLiked, initialLikes]);

  async function handleLike() {
    if (like.pending) return;
    const nextLiked = !like.liked;
    // Counter only moves on the first-ever like by this user. Subsequent
    // un-like / re-like cycles are personal-state-only.
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
