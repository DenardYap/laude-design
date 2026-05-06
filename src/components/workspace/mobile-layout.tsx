"use client";

import { cn } from "@/lib/utils";
import { MobileViewSwitcher } from "@/components/workspace/mobile-view-switcher";
import type { MobileLayoutProps } from "@/components/workspace/types/workspace";

export function MobileLayout({
  mobileView,
  onChangeView,
  chatPane,
  canvasPane,
}: MobileLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MobileViewSwitcher value={mobileView} onChange={onChangeView} />
      <div className="relative min-h-0 flex-1">
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            mobileView === "chat" ? "z-10" : "pointer-events-none invisible",
          )}
          aria-hidden={mobileView !== "chat"}
        >
          {chatPane}
        </div>
        <div
          className={cn(
            "absolute inset-0 flex flex-col",
            mobileView === "canvas" ? "z-10" : "pointer-events-none invisible",
          )}
          aria-hidden={mobileView !== "canvas"}
        >
          {canvasPane}
        </div>
      </div>
    </div>
  );
}
