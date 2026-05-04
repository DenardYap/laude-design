import type { ReactNode } from 'react';
import { cn } from "@/lib/utils";

export interface DataListItem {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  href?: string;
}

interface DataListProps {
  items: DataListItem[];
  className?: string;
  renderItem?: (item: DataListItem) => ReactNode;
}

/**
 * Vertical list of rows separated by a single divider — used for projects,
 * skills, settings rows. One source of truth for that layout.
 */
export function DataList({ items, className, renderItem }: DataListProps) {
  return (
    <ul className={cn("flex flex-col", className)}>
      {items.map((item, idx) => (
        <li
          key={item.id}
          className={cn(
            "flex items-center justify-between gap-4 px-1 py-4",
            idx !== items.length - 1 && "border-b border-border",
          )}
        >
          {renderItem ? (
            renderItem(item)
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold tracking-tight text-ink">
                  {item.title}
                </div>
                {item.subtitle ? (
                  <div className="mt-0.5 truncate text-xs text-ink-muted">{item.subtitle}</div>
                ) : null}
              </div>
              {item.meta ? (
                <div className="hidden text-xs text-ink-muted sm:block">{item.meta}</div>
              ) : null}
              {item.actions ? <div className="flex items-center gap-1">{item.actions}</div> : null}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
