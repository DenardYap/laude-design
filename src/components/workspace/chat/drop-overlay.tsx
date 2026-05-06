import { UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

export function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-10 py-8",
          "border-brand bg-brand-soft/40",
        )}
      >
        <UploadCloud className="size-8 text-brand" />
        <p className="text-sm font-semibold text-foreground">Drop files here</p>
        <p className="text-xs text-ink-muted">Images · PDF · TXT · Markdown · CSV</p>
      </div>
    </div>
  );
}
