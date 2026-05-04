import type { ReactNode } from 'react';
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /**
   * Empty states must include a CTA per the design rules. Make this prominent.
   */
  action: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-sunken/40 px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-4 text-ink-subtle">{icon}</div> : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-5">{action}</div>
    </div>
  );
}
