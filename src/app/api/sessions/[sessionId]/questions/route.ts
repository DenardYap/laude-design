import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const questionItemSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      recommended: z.boolean().optional(),
    }),
  ),
  allowFreeText: z.boolean().optional(),
});

const questionsPayloadSchema = z.object({
  rationale: z.string().nullable().optional(),
  items: z.array(questionItemSchema),
});

export type ClarifyingQuestionsPayload = z.infer<typeof questionsPayloadSchema>;
export type ClarifyingQuestionItem = z.infer<typeof questionItemSchema>;

export interface ClarifyingQuestionSetDTO {
  id: string;
  status: "OPEN" | "ANSWERED" | "DISMISSED";
  questions: ClarifyingQuestionsPayload;
  answers: Record<string, AnswerValue> | null;
  createdAt: string;
}

export type AnswerValue =
  | { kind: "option"; optionId: string }
  | { kind: "options"; optionIds: string[] }
  | { kind: "text"; text: string };

const answerValueSchema: z.ZodType<AnswerValue> = z.union([
  z.object({ kind: z.literal("option"), optionId: z.string() }),
  z.object({ kind: z.literal("options"), optionIds: z.array(z.string()) }),
  z.object({ kind: z.literal("text"), text: z.string().min(1).max(2000) }),
]);

async function ensureSessionAccess(sessionId: string, userId: string) {
  return db.chatSession.findFirst({
    where: { id: sessionId, project: { userId } },
    select: { id: true },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  const access = await ensureSessionAccess(sessionId, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sets = await db.clarifyingQuestionSet.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      questions: true,
      answers: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    sets: sets.map(
      (s): ClarifyingQuestionSetDTO => ({
        id: s.id,
        status: s.status,
        questions: questionsPayloadSchema.parse(s.questions),
        answers: s.answers as Record<string, AnswerValue> | null,
        createdAt: s.createdAt.toISOString(),
      }),
    ),
  });
}

const submitSchema = z.object({
  setId: z.string().min(1),
  action: z.enum(["answer", "dismiss"]),
  answers: z.record(z.string(), answerValueSchema).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  const access = await ensureSessionAccess(sessionId, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = submitSchema.parse(await req.json());

  const set = await db.clarifyingQuestionSet.findFirst({
    where: { id: body.setId, sessionId },
    select: { id: true, status: true, questions: true },
  });
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
  if (set.status !== "OPEN") {
    return NextResponse.json({ error: "Already resolved" }, { status: 409 });
  }

  if (body.action === "dismiss") {
    await db.clarifyingQuestionSet.update({
      where: { id: set.id },
      data: { status: "DISMISSED", answeredAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.answers) {
    return NextResponse.json({ error: "answers required" }, { status: 400 });
  }

  await db.clarifyingQuestionSet.update({
    where: { id: set.id },
    data: {
      status: "ANSWERED",
      answers: body.answers,
      answeredAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
