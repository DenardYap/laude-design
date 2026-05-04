"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ListChecks, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DesignPlanDTO } from "@/app/api/plans/[planId]/route";
import type { InlineDesignPlanProps } from "@/components/workspace/chat/types/misc";

async function fetchPlan(planId: string): Promise<DesignPlanDTO | null> {
  const res = await fetch(`/api/plans/${planId}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { plan: DesignPlanDTO | null };
  return data.plan;
}

export function InlineDesignPlan({
  planId,
  fallbackTitle,
  fallbackSteps,
}: InlineDesignPlanProps) {
  const { data: plan } = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => (planId ? fetchPlan(planId) : Promise.resolve(null)),
    enabled: Boolean(planId),
    // Plans only mutate while an agent turn is ticking off steps. Once the
    // server marks it terminal, the checklist is frozen — stop polling so
    // finished message threads don't hammer the API forever.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "COMPLETED" || status === "ABANDONED") return false;
      return 1500;
    },
    staleTime: 500,
  });

  const title = plan?.title ?? fallbackTitle ?? "Design plan";
  // Until the server returns, fall back to the steps from the tool input —
  // they're identical except for the (always-false) initial completed flag.
  const steps =
    plan?.steps ??
    (fallbackSteps?.map((s) => ({ ...s, completed: false })) ?? []);

  if (steps.length === 0) {
    return (
      <div className="my-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-subtle">
        <Loader2 className="size-3 animate-spin" />
        Planning design…
      </div>
    );
  }

  const total = steps.length;
  const done = steps.filter((s) => s.completed).length;
  const isComplete = plan?.status === "COMPLETED";

  return (
    <div className="my-2 rounded-2xl border border-border bg-surface px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <ListChecks className="size-3.5 shrink-0 text-ink-muted" />
        <span className="flex-1 truncate text-xs font-medium text-ink">
          {title}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            isComplete
              ? "bg-success/15 text-success"
              : "bg-surface-sunken text-ink-muted",
          )}
        >
          {done}/{total}
        </span>
      </div>
      <ul className="space-y-1">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className="flex items-start gap-2 text-xs leading-relaxed"
          >
            <span
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                step.completed
                  ? "border-success bg-success text-success-foreground"
                  : "border-ink-subtle/40 bg-background",
              )}
              aria-hidden
            >
              {step.completed ? <Check className="size-2.5" /> : null}
            </span>
            <span
              className={cn(
                "flex-1",
                step.completed
                  ? "text-ink-subtle line-through decoration-ink-subtle/60"
                  : "text-ink-muted",
              )}
            >
              <span className="mr-1 tabular-nums text-ink-subtle">
                {i + 1}.
              </span>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
