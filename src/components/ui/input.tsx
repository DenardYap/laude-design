import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from "@/lib/utils";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // 16px text on phone keeps iOS Safari from auto-zooming the
          // viewport when the input takes focus. We drop back to 14px
          // (`text-sm`) at the `sm` breakpoint where the cramped feel of
          // larger text in dense forms outweighs the zoom concern.
          "flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1 text-base text-ink shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
