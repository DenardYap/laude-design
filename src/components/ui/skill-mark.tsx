import type { SVGProps } from 'react';
import { cn } from "@/lib/utils";

/**
 * Brand glyph: a lightbulb with an inscribed fountain-pen nib. Signifies
 * "skills" — knowledge (bulb) authored as text snippets (pen). Used as the
 * empty-state mark for the Skills surfaces. Inherits color via `currentColor`;
 * size via Tailwind size-* utilities (defaults to size-4).
 */
export function SkillMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
      {...props}
    >
      <path d="M12 1v1.5" />
      <path d="M2 9h1.5" />
      <path d="M20.5 9H22" />
      <path d="m4.6 4.5 1 1" />
      <path d="m19.4 4.5-1 1" />

      <path d="M8 14C6.3 12.5 5 10.7 5 8.5 5 5.2 8.1 2.5 12 2.5s7 2.7 7 6c0 2.2-1.3 4-3 5.5z" />

      <path d="M8.5 16.5h7" />
      <path d="M9 19h6" />
      <path d="M10 21.25h4v.25c0 .7-.9 1.25-2 1.25s-2-.55-2-1.25z" />

      <path d="m12 5-2.5 4.5h5z" />
      <path d="M12 6.5v3" />

      <path d="M10 9.5h4v4h-4z" />
    </svg>
  );
}
