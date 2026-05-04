import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex h-[100dvh] w-screen flex-col bg-background">
      {/* WorkspaceHeader — h-14, bg-surface, back arrow + project name + actions */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-surface px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </header>

      {/* Sub-header row: session tabs (left) | canvas header (right) */}
      <div className="grid h-10 shrink-0 grid-cols-[30fr_70fr]">
        <div className="flex items-center gap-1.5 bg-surface px-3">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <div className="flex items-center gap-2 bg-background px-3">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="size-7 rounded-md" />
        </div>
      </div>

      {/* Main content area */}
      <div className="grid min-h-0 flex-1 grid-cols-[30fr_70fr]">
        {/* Chat pane — bg-surface */}
        <div className="flex flex-col overflow-hidden bg-surface">
          {/* Simulated message history */}
          <div className="flex flex-1 flex-col px-3 py-3">
            <div className="w-full space-y-2">
              <Skeleton className="h-3 w-4/5 rounded-full" />
              <Skeleton className="h-3 w-3/5 rounded-full" />
              <Skeleton className="h-3 w-2/3 rounded-full" />
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-2/3 space-y-2 rounded-2xl rounded-br-sm bg-muted px-3 py-2.5">
                <Skeleton className="h-3 w-full rounded-full bg-muted-foreground/20" />
                <Skeleton className="h-3 w-4/5 rounded-full bg-muted-foreground/20" />
              </div>
            </div>
            <div className="mt-4 w-full space-y-2">
              <Skeleton className="h-3 w-3/4 rounded-full" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-2/5 rounded-full" />
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              <Skeleton className="size-3 rounded-full" />
              <Skeleton className="h-2.5 w-28 rounded-full" />
            </div>
            <div className="mt-4 w-full space-y-2">
              <Skeleton className="h-3 w-1/2 rounded-full" />
              <Skeleton className="h-3 w-4/5 rounded-full" />
            </div>
          </div>
          {/* Composer */}
          <div className="p-3">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>

        {/* Canvas pane — bg-background with inner rounded box matching CanvasPane */}
        <div className="flex flex-col bg-background p-2">
          <Skeleton className="flex-1 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
