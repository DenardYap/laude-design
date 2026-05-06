import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import Link, { type LinkProps } from "next/link";

import { cn } from "@/lib/utils";

export interface TextLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    LinkProps {
  external?: boolean;
}

const TextLink = forwardRef<HTMLAnchorElement, TextLinkProps>(
  ({ className, external, ...props }, ref) => {
    const externalProps = external
      ? { target: "_blank", rel: "noopener noreferrer" as const }
      : undefined;
    return (
      <Link
        ref={ref}
        className={cn(
          "font-medium text-ink underline-offset-4 hover:underline",
          className,
        )}
        {...externalProps}
        {...props}
      />
    );
  },
);
TextLink.displayName = "TextLink";

export { TextLink };
