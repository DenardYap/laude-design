import { PageHeader, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Markdown or text files the agent can use as context. Click a skill to edit or share it."
      />
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My skills</TabsTrigger>
          <TabsTrigger value="public">Public library</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="space-y-px overflow-hidden rounded-lg border border-border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
