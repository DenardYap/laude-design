"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import type { MarkdownProps } from "@/components/workspace/chat/types/misc";
import { urlTransform } from "@/components/workspace/chat/utils/markdown";

const COMPONENTS: Components = {
  p: ({ className, ...props }) => (
    <p
      className={cn("whitespace-pre-wrap break-words [&:not(:last-child)]:mb-2", className)}
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-ink", className)} {...props} />
  ),
  em: ({ className, ...props }) => (
    <em className={cn("italic", className)} {...props} />
  ),
  del: ({ className, ...props }) => (
    <del className={cn("text-ink-muted", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      target="_blank"
      rel="noreferrer"
      className={cn("text-ink underline underline-offset-2 hover:text-ink/80", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-2 ml-4 list-disc space-y-1 marker:text-ink-subtle", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-2 ml-4 list-decimal space-y-1 marker:text-ink-subtle", className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("[&>p]:mb-0", className)} {...props} />
  ),
  h1: ({ className, ...props }) => (
    <h1 className={cn("mt-3 mb-2 text-base font-semibold text-ink", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("mt-3 mb-2 text-sm font-semibold text-ink", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-2 mb-1 text-sm font-semibold text-ink", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("my-2 border-l-2 border-border pl-3 text-ink-muted italic", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-3 border-border", className)} {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className?.startsWith("language-");
    if (isInline) {
      return (
        <code
          className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.85em] text-ink"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("font-mono text-[0.85em]", className)} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "my-2 overflow-x-auto rounded-md border border-border bg-surface-sunken p-2 text-xs",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className={cn("w-full border-collapse text-xs", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("border border-border bg-surface-sunken px-2 py-1 text-left font-semibold", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border border-border px-2 py-1", className)} {...props} />
  ),
};

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("text-sm leading-relaxed text-ink", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTS}
        urlTransform={urlTransform}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
