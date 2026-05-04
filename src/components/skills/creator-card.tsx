"use client";

import { Bookmark } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui";
import { getInitials } from "@/lib/utils";
import type { CreatorCardProps } from "@/components/skills/types/skill-detail";

export function CreatorCard({ name, image, saves, description }: CreatorCardProps) {
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
