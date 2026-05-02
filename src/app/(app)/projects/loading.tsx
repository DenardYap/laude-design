import { PageHeader, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title="Projects"
        description="Open a project to start designing with your favorite model."
      />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="size-9" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
