import * as React from "react";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./button";

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    Omit<VariantProps<typeof buttonVariants>, "size"> {
  /** Required so icon-only controls are accessible */
  "aria-label": string;
  icon: React.ReactNode;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, variant = "ghost", ...props }, ref) => (
    <Button
      ref={ref}
      type={props.type ?? "button"}
      variant={variant}
      size="icon"
      className={cn(className)}
      {...props}
    >
      {icon}
    </Button>
  ),
);
IconButton.displayName = "IconButton";

export { IconButton };
