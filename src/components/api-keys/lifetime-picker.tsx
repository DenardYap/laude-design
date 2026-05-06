import { cn } from "@/lib/utils";
import { LIFETIME_OPTIONS } from "@/lib/api-keys/expiry";
import type { LifetimePickerProps } from "@/components/api-keys/types/api-keys";

export function LifetimePicker({ value, onChange, providerName }: LifetimePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={`Auto-delete ${providerName} key`}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-ink-muted">Auto-delete after</span>
      {LIFETIME_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors",
              active
                ? "border-transparent bg-brand text-brand-foreground"
                : "border-border bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
