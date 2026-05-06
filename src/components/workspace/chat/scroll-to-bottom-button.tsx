import { ChevronDown } from "lucide-react";

import type { ScrollToBottomButtonProps } from "@/components/workspace/chat/types/messages";

export function ScrollToBottomButton({ onClick }: ScrollToBottomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to bottom"
      className="absolute bottom-3 right-4 flex size-7 items-center justify-center rounded-full border border-border bg-background shadow-md text-ink-muted transition-colors hover:bg-muted hover:text-ink"
    >
      <ChevronDown className="size-4" />
    </button>
  );
}
