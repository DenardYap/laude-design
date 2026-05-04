import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const pillVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        brand: "border-transparent bg-brand text-brand-foreground",
        neutral: "border-transparent bg-surface-sunken text-ink-muted",
        outline: "border-border text-ink",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        destructive: "border-transparent bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface PillProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {}

const Pill = forwardRef<HTMLSpanElement, PillProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(pillVariants({ tone }), className)} {...props} />
  ),
);
Pill.displayName = "Pill";

export { Pill, pillVariants };
