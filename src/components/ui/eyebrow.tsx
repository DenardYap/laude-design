import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from "@/lib/utils";

export type EyebrowProps = HTMLAttributes<HTMLParagraphElement>;

/**
 * Small uppercase label that sits above a heading or section.
 * Use sparingly — gives a section a category without competing with the title.
 */
const Eyebrow = forwardRef<HTMLParagraphElement, EyebrowProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted",
        className,
      )}
      {...props}
    />
  ),
);
Eyebrow.displayName = "Eyebrow";

export { Eyebrow };
