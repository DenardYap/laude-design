import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconBadgeVariants = cva(
  "inline-grid shrink-0 place-items-center rounded-md [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        brand: "bg-brand text-brand-foreground",
        soft: "bg-brand-soft text-brand-foreground",
        neutral: "bg-surface-sunken text-ink",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        destructive: "bg-destructive-soft text-destructive",
      },
      size: {
        sm: "size-6 [&>svg]:size-3.5",
        md: "size-8 [&>svg]:size-4",
        lg: "size-10 [&>svg]:size-5",
        xl: "size-20 [&>svg]:size-10",
      },
      shape: {
        square: "rounded-md",
        rounded: "rounded-lg",
        circle: "rounded-full",
      },
    },
    defaultVariants: {
      tone: "soft",
      size: "md",
      shape: "rounded",
    },
  },
);

export interface IconBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof iconBadgeVariants> {
  icon: React.ReactNode;
}

const IconBadge = React.forwardRef<HTMLSpanElement, IconBadgeProps>(
  ({ className, tone, size, shape, icon, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(iconBadgeVariants({ tone, size, shape }), className)}
      {...props}
    >
      {icon}
    </span>
  ),
);
IconBadge.displayName = "IconBadge";

export { IconBadge, iconBadgeVariants };
