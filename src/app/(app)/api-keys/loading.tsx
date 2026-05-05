import { ShieldAlert } from "lucide-react";

import { PageHeader, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title="Configure API"
        description="Bring your own keys for the LLMs you want to use."
      />
      <p className="flex items-start gap-1.5 text-xs text-ink-muted">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <span>
          Use a dedicated key per provider — never reuse a production key. Keys are stored in
          this browser and sent to our server only when processing your AI requests.
        </span>
      </p>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
