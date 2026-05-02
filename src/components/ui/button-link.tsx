import * as React from "react";
import Link, { type LinkProps } from "next/link";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    LinkProps,
    VariantProps<typeof buttonVariants> {}

const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant, size, ...props }, ref) => (
    <Link ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
);
ButtonLink.displayName = "ButtonLink";

export { ButtonLink };
