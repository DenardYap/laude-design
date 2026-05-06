"use client";

import * as React from "react";

import type { UsageRingProps } from "@/components/workspace/chat/types/context-usage";

export function UsageRing({ ratio, className }: UsageRingProps) {
  const radius = 7.25;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;
  return (
    <svg
      viewBox="0 0 20 20"
      role="img"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="hsl(var(--border-strong))"
        strokeWidth="2.5"
        fill="none"
      />
      {dash > 0 ? (
        <circle
          cx="10"
          cy="10"
          r={radius}
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 10 10)"
        />
      ) : null}
    </svg>
  );
}
