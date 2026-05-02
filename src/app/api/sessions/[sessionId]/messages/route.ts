import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;

  const chat = await db.chatSession.findFirst({
    where: { id: sessionId, project: { userId: session.user.id } },
    select: { id: true },
  });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, parts: true, createdAt: true },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
    })),
  });
}
