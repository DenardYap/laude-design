import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from "@/lib/utils";

const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        // 16px on phone prevents iOS Safari's focus-zoom; downgrades to
        // the cleaner 14px `text-sm` once we're at `sm` and up. The
        // composer overrides this with its own classes — we keep the
        // same `text-base sm:text-sm` shape there for consistency.
        "flex min-h-20 w-full rounded-md border border-input bg-surface px-3 py-2 text-base text-ink shadow-sm placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
