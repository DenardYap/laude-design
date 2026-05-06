"use client";

import * as React from "react";

import type { UsageRowProps } from "@/components/workspace/chat/types/context-usage";

export function UsageRow({ label, value }: UsageRowProps) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}
