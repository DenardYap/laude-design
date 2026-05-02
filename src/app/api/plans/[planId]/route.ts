import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const planStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  completed: z.boolean(),
});

const planStepsSchema = z.array(planStepSchema);

export type DesignPlanStep = z.infer<typeof planStepSchema>;

export interface DesignPlanDTO {
  id: string;
  title: string;
  status: "ACTIVE" | "COMPLETED" | "ABANDONED";
  steps: DesignPlanStep[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { planId } = await params;

  // Auth chain: plan → session → project → owning user.
  const plan = await db.designPlan.findFirst({
    where: {
      id: planId,
      session: { project: { userId: session.user.id } },
    },
    select: {
      id: true,
      title: true,
      status: true,
      steps: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
    },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    plan: {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      steps: planStepsSchema.parse(plan.steps),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      completedAt: plan.completedAt?.toISOString() ?? null,
    } satisfies DesignPlanDTO,
  });
}
