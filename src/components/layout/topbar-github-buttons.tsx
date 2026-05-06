"use client";

import { Github, Star } from "lucide-react";

import { Button } from "@/components/ui";
import { GITHUB_REPO, formatStarCount } from "@/components/layout/utils/github";
import type { TopbarGithubButtonsProps } from "@/components/layout/types/layout";

export function TopbarGithubButtons({ starCount }: TopbarGithubButtonsProps) {
  return (
    <>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="hidden gap-2 rounded-full px-3 sm:inline-flex"
      >
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Star on GitHub"
        >
          <Star className="size-3.5" />
          <span className="text-xs">Star</span>
          {starCount !== undefined ? (
            <span className="text-xs text-ink-muted">{formatStarCount(starCount)}</span>
          ) : null}
        </a>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="GitHub repo"
        className="hidden sm:inline-flex"
      >
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github className="size-5" />
        </a>
      </Button>
    </>
  );
}
