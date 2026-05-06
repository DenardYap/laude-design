"use client";

export function RootEmptyState() {
  return (
    <div className="relative pb-2 pl-6 pr-2 pt-1">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 left-[13px] top-0 w-px bg-border/60"
      />
      <p className="text-xs text-ink-muted">
        No files yet — right-click anywhere or use the buttons above to create
        your first folder or design.
      </p>
    </div>
  );
}
