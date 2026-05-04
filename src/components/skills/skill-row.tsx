"use client";

import type { ReactNode } from 'react';

import Link from "next/link";
import { Bookmark, Globe, Heart, Lock } from "lucide-react";

import { Pill } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import { formatTokens } from "./skill-size";
import { MetaCell, NameCell } from "./skill-row-cells";

interface BaseSkill {
  id: string;
  name: string;
  description: string | null;
  charCount: number;
  updatedAt: Date | string;
}

export interface MineSkill extends BaseSkill {
  isPublic: boolean;
  appliedByDefault: boolean;
  /** True when the skill was cloned from someone else's public skill. */
  isClone: boolean;
  /** Original creator's display name when `isClone`; null for self-authored. */
  authorName: string | null;
}

export interface PublicSkill extends BaseSkill {
  authorName: string | null;
  isMine: boolean;
  saves: number;
  likes: number;
}

interface RowFrameProps {
  href: string;
  ariaLabel: string;
  zebra: boolean;
  children: ReactNode;
  /** Number of grid columns this row spans (must match the parent grid). */
  colSpan: number;
}

function RowFrame({ href, ariaLabel, zebra, children, colSpan }: RowFrameProps) {
  return (
    <li
      className={cn(
        "group relative grid grid-cols-subgrid items-center",
        zebra ? "bg-surface-sunken/30" : "bg-transparent",
        "hover:bg-surface-sunken",
      )}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <Link
        href={href}
        aria-label={ariaLabel}
        className="absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {children}
    </li>
  );
}

export function MineSkillRow({ skill, zebra }: { skill: MineSkill; zebra: boolean }) {
  return (
    <RowFrame
      href={`/skills/${skill.id}`}
      ariaLabel={`Open ${skill.name}`}
      zebra={zebra}
      colSpan={6}
    >
      <NameCell name={skill.name} description={skill.description} />
      <MetaCell>
        <span className="truncate">
          {skill.isClone ? (skill.authorName ?? "Anonymous user") : "you"}
        </span>
      </MetaCell>
      <MetaCell>
        {skill.isPublic ? (
          <Pill tone="success" className="h-5 px-1.5 py-0 text-[10px]">
            <Globe />
            Public
          </Pill>
        ) : (
          <Pill tone="neutral" className="h-5 px-1.5 py-0 text-[10px]">
            <Lock />
            Private
          </Pill>
        )}
      </MetaCell>
      <MetaCell>
        {skill.appliedByDefault ? (
          <Pill tone="outline" className="h-5 px-1.5 py-0 text-[10px]">
            Default
          </Pill>
        ) : (
          <span className="text-ink-subtle">—</span>
        )}
      </MetaCell>
      <MetaCell>{formatTokens(skill.charCount)}</MetaCell>
      <MetaCell>{formatRelativeTime(skill.updatedAt)}</MetaCell>
    </RowFrame>
  );
}

export function PublicSkillRow({ skill, zebra }: { skill: PublicSkill; zebra: boolean }) {
  return (
    <RowFrame
      href={`/skills/${skill.id}`}
      ariaLabel={`Open ${skill.name}`}
      zebra={zebra}
      colSpan={6}
    >
      <NameCell name={skill.name} description={skill.description} />
      <MetaCell>
        <span className="truncate">
          by {skill.isMine ? "you" : (skill.authorName ?? "anonymous")}
        </span>
      </MetaCell>
      <MetaCell>
        <Bookmark className="size-3.5 text-ink-subtle" />
        <span className="ml-1">{skill.saves}</span>
      </MetaCell>
      <MetaCell>
        <Heart className="size-3.5 text-ink-subtle" />
        <span className="ml-1">{skill.likes}</span>
      </MetaCell>
      <MetaCell>{formatTokens(skill.charCount)}</MetaCell>
      <MetaCell>{formatRelativeTime(skill.updatedAt)}</MetaCell>
    </RowFrame>
  );
}

/** Light header row that explains each column. Use as the first row in the grid. */
export function SkillTableHeader({
  columns,
  colSpan,
}: {
  columns: ReactNode[];
  colSpan: number;
}) {
  return (
    <li
      className="grid grid-cols-subgrid border-b border-border bg-surface-sunken/40"
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      {columns.map((c, i) => (
        <div
          key={i}
          className={cn(
            "px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-subtle",
            i === 0 ? "text-left" : "text-right",
          )}
        >
          {c}
        </div>
      ))}
    </li>
  );
}
