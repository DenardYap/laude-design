import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <Skeleton className="size-6" />
        <Skeleton className="h-4 w-40" />
        <div className="flex-1" />
        <Skeleton className="size-7" />
        <Skeleton className="size-7 rounded-full" />
      </div>
      <div className="grid h-10 shrink-0 grid-cols-[3fr_7fr] border-b border-border">
        <div className="flex items-center gap-2 bg-surface px-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex items-center gap-2 px-3">
          <Skeleton className="h-5 w-28" />
          <div className="flex-1" />
          <Skeleton className="size-6" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[3fr_7fr]">
        <div className="flex flex-col gap-3 bg-surface p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <div className="flex-1" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="flex items-center justify-center p-6">
          <Skeleton className="h-full max-h-[600px] w-full max-w-3xl" />
        </div>
      </div>
    </div>
  );
}
