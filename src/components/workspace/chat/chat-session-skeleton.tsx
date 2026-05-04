// ---------------------------------------------------------------------------
// Skeleton primitives
// ---------------------------------------------------------------------------

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className={`h-3 animate-pulse rounded-full bg-border ${width}`}
    />
  );
}

function SkeletonAssistantBubble({
  className,
  lines,
}: {
  className?: string;
  lines: string[];
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <div className="w-full space-y-2">
        {lines.map((w, i) => (
          <SkeletonLine key={i} width={w} />
        ))}
      </div>
    </div>
  );
}

function SkeletonUserBubble({
  className,
  lines,
}: {
  className?: string;
  lines: string[];
}) {
  return (
    <div className={`flex flex-col items-end gap-1 ${className ?? ""}`}>
      <div className="w-2/3 space-y-2 rounded-2xl rounded-br-sm bg-surface-sunken px-3 py-2.5">
        {lines.map((w, i) => (
          <SkeletonLine key={i} width={w} />
        ))}
      </div>
    </div>
  );
}

function SkeletonToolRow({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 pl-3 ${className ?? ""}`}>
      <div className="size-3 animate-pulse rounded-full bg-border" />
      <div className="h-2.5 w-28 animate-pulse rounded-full bg-border" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatSessionSkeleton — public API
// ---------------------------------------------------------------------------

export function ChatSessionSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col overflow-hidden px-3 py-3"
      aria-busy="true"
      aria-label="Loading chat history"
    >
      <SkeletonAssistantBubble lines={["w-4/5", "w-3/5", "w-2/3"]} />
      <SkeletonUserBubble className="mt-4" lines={["w-full", "w-4/5"]} />
      <SkeletonAssistantBubble
        className="mt-4"
        lines={["w-3/4", "w-full", "w-2/5"]}
      />
      <SkeletonToolRow className="mt-4" />
      <SkeletonAssistantBubble className="mt-4" lines={["w-1/2", "w-4/5"]} />
      <SkeletonUserBubble className="mt-4" lines={["w-full"]} />
    </div>
  );
}
