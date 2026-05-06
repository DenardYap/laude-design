import type { SVGProps } from 'react';
import { cn } from "@/lib/utils";

export function FramesMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
      {...props}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M12 5.5 L18.5 12 L12 18.5 L5.5 12 Z" />
    </svg>
  );
}
