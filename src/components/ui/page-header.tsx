import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from "@/lib/utils";

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

/**
 * Page-level title block. Pair with SectionHeader for sub-sections.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", className)}
      {...props}
    >
      <div className="space-y-1">
        {eyebrow ? <div className="mb-1">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
