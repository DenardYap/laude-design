"use client";

import type { ReactNode } from "react";
import { LayoutDashboard, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MobileViewSwitcherProps } from "@/components/workspace/types/workspace";

function SwitcherButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-brand/40 text-ink"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function MobileViewSwitcher({ value, onChange }: MobileViewSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Workspace view"
      className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-2 py-1.5"
    >
      <SwitcherButton
        active={value === "chat"}
        onClick={() => onChange("chat")}
        icon={<MessageSquare className="size-3.5" />}
        label="Chat"
      />
      <SwitcherButton
        active={value === "canvas"}
        onClick={() => onChange("canvas")}
        icon={<LayoutDashboard className="size-3.5" />}
        label="Canvas"
      />
    </div>
  );
}
