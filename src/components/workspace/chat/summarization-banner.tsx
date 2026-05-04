import { Scissors } from "lucide-react";

export function SummarizationBanner() {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-ink-subtle">
        <Scissors className="size-3 shrink-0" />
        Context summarized
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
