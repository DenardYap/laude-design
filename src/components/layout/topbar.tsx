"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Github, Star } from "lucide-react";

import { Button } from "@/components/ui";
import { UserMenu } from "@/components/layout/user-menu";

const GITHUB_REPO = "DenardYap/laude-design";

function formatStarCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return count.toLocaleString();
}

async function fetchStarCount(): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`);
  if (!res.ok) throw new Error("Failed to fetch star count");
  const data = (await res.json()) as { stargazers_count: number };
  return data.stargazers_count;
}

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Topbar({ user }: TopbarProps) {
  const { data: starCount } = useQuery({
    queryKey: ["github-stars", GITHUB_REPO],
    queryFn: fetchStarCount,
    staleTime: 5 * 60_000,
  });

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border bg-background px-6">
      <Button asChild variant="outline" size="sm" className="gap-2 rounded-full px-3">
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
      <Button asChild variant="ghost" size="icon" aria-label="GitHub repo">
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github className="size-5" />
        </a>
      </Button>

      <div className="ml-1">
        <UserMenu user={user} size="sm" />
      </div>
    </header>
  );
}
