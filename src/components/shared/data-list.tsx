import * as React from "react";

import { cn } from "@/lib/utils";

export interface DataListItem {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  href?: string;
}

interface DataListProps {
  items: DataListItem[];
  className?: string;
  renderItem?: (item: DataListItem) => React.ReactNode;
}

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
                <div className="truncate text-base font-semibold tracking-tight">{item.title}</div>
                {item.subtitle ? (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </div>
                ) : null}
              </div>
              {item.meta ? (
                <div className="hidden text-xs text-muted-foreground sm:block">{item.meta}</div>
              ) : null}
              {item.actions ? <div className="flex items-center gap-1">{item.actions}</div> : null}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
