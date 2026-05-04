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

  // Always create a fresh session. The client-side guard in SessionTabs is the
  // single source of truth for "is the user already on a usable empty tab?" —
  // it knows about unsent draft text and pending attachments that the server
  // can't see, and it lets the user stack tabs intentionally if they want.
  const session = await db.chatSession.create({
    data: {
      projectId,
      title: "New Session",
    },
    select: { id: true, title: true, updatedAt: true },
  });
  revalidatePath(`/projects/${projectId}`);
  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.toISOString(),
    isEmpty: true,
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
