"use client";

import { cn } from "@/lib/utils";

export function SwatchRow({
  options,
  value,
  onSelect,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isTransparent = opt.value === "transparent";
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            aria-label={opt.label}
            aria-pressed={selected}
            className={cn(
              "size-6 rounded-md border border-border transition-shadow",
              selected && "ring-2 ring-brand ring-offset-1 ring-offset-surface",
            )}
            style={{
              backgroundColor: isTransparent ? undefined : opt.value,
              backgroundImage: isTransparent
                ? "linear-gradient(45deg, hsl(var(--surface-sunken)) 25%, transparent 25%, transparent 75%, hsl(var(--surface-sunken)) 75%), linear-gradient(45deg, hsl(var(--surface-sunken)) 25%, transparent 25%, transparent 75%, hsl(var(--surface-sunken)) 75%)"
                : undefined,
              backgroundSize: isTransparent ? "8px 8px" : undefined,
              backgroundPosition: isTransparent ? "0 0, 4px 4px" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
