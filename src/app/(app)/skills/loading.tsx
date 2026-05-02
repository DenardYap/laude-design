import { PageHeader, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Skills"
        description="Markdown or text files the agent can use as context. Share publicly to help others."
      />
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My skills</TabsTrigger>
          <TabsTrigger value="public">Public library</TabsTrigger>
        </TabsList>
      </Tabs>
      <Skeleton className="h-9 max-w-md" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
