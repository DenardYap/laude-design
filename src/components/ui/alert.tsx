import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg+div]:translate-y-[-2px] [&:has(svg)]:pl-11",
  {
    variants: {
      tone: {
        neutral: "bg-surface text-ink border-border",
        warning: "border-warning/40 bg-warning-soft text-ink [&>svg]:text-warning",
        destructive:
          "border-destructive/40 bg-destructive-soft text-ink [&>svg]:text-destructive",
        success: "border-success/40 bg-success-soft text-ink [&>svg]:text-success",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, tone, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ tone }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-semibold leading-none tracking-tight text-ink", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm leading-relaxed text-ink-muted [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
