import { db } from "@/lib/db";
import type { ChatSessionDTO, DesignDTO, FolderDTO } from "@/lib/workspace/types";

export async function getWorkspaceData(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, name: true },
  });
  if (!project) return null;

  const [sessions, folders, designs] = await Promise.all([
    db.chatSession.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        summarizedCount: true,
        totalCostUsd: true,
        // Lifetime usage stats hydrated into the chatbox popover. See
        // SessionUsage in `types.ts` for the semantics of each field.
        lastInputTokens: true,
        cumulativeOutputTokens: true,
        cumulativeFoldedTokens: true,
        _count: { select: { messages: true } },
      },
    }),
    db.folder.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    db.design.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: {
        files: {
          orderBy: { path: "asc" },
          select: { path: true, content: true },
        },
      },
    }),
  ]);

  if (sessions.length === 0) {
    const created = await db.chatSession.create({
      data: { projectId, title: "New Session" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        summarizedCount: true,
        totalCostUsd: true,
        lastInputTokens: true,
        cumulativeOutputTokens: true,
        cumulativeFoldedTokens: true,
        _count: { select: { messages: true } },
      },
    });
    sessions.push(created);
  }

  const sessionDTOs: ChatSessionDTO[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt.toISOString(),
    isEmpty: s._count.messages === 0,
    usage: {
      summarizedCount: s.summarizedCount,
      totalCostUsd: s.totalCostUsd,
      currentInputTokens: s.lastInputTokens,
      lifetimeOutputTokens: s.cumulativeOutputTokens,
      lifetimeFoldedTokens: s.cumulativeFoldedTokens,
    },
  }));

  return {
    project,
    sessions: sessionDTOs,
    folders: folders as FolderDTO[],
    designs: designs.map((d): DesignDTO => ({
      id: d.id,
      name: d.name,
      folderId: d.folderId,
      files: d.files,
      updatedAt: d.updatedAt.toISOString(),
    })),
  };
}

export async function getProjectMessages(sessionId: string) {
  const messages = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return messages;
}
