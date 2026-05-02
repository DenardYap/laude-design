"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function assertProjectAccess(projectId: string) {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
  return user;
}

export async function createSession(projectId: string) {
  await assertProjectAccess(projectId);

  // Defensive dedupe: if there's already a "New Session"-style session with no
  // messages, hand the user that one instead of stacking up empty tabs. Catches
  // both the spam-click case and the cross-tab case (another tab already made
  // an empty session that hasn't been used yet).
  const existingEmpty = await db.chatSession.findFirst({
    where: { projectId, messages: { none: {} } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, order: true, updatedAt: true },
  });
  if (existingEmpty) {
    return {
      id: existingEmpty.id,
      title: existingEmpty.title,
      order: existingEmpty.order,
      updatedAt: existingEmpty.updatedAt.toISOString(),
      isEmpty: true,
      reused: true as const,
    };
  }

  const count = await db.chatSession.count({ where: { projectId } });
  const session = await db.chatSession.create({
    data: {
      projectId,
      title: "New Session",
      order: count,
    },
    select: { id: true, title: true, order: true, updatedAt: true },
  });
  revalidatePath(`/projects/${projectId}`);
  return {
    id: session.id,
    title: session.title,
    order: session.order,
    updatedAt: session.updatedAt.toISOString(),
    isEmpty: true,
    reused: false as const,
  };
}

export async function renameSession(sessionId: string, title: string) {
  const user = await requireUser();
  const session = await db.chatSession.findFirst({
    where: { id: sessionId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!session) throw new Error("Session not found");
  const trimmed = title.trim().slice(0, 80) || "Untitled";
  await db.chatSession.update({ where: { id: session.id }, data: { title: trimmed } });
  revalidatePath(`/projects/${session.projectId}`);
}

export async function deleteSession(sessionId: string) {
  const user = await requireUser();
  const session = await db.chatSession.findFirst({
    where: { id: sessionId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!session) throw new Error("Session not found");
  await db.chatSession.delete({ where: { id: session.id } });
  revalidatePath(`/projects/${session.projectId}`);
  return { projectId: session.projectId };
}
