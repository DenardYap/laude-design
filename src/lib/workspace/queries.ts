import { db } from "@/lib/db";
import type { ChatSessionDTO, DesignDTO, FolderDTO } from "@/lib/workspace/types";

export async function getWorkspaceData(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, name: true },
  });
  if (!project) return null;

  const [sessions, folders, designs, apiKeys] = await Promise.all([
    db.chatSession.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        order: true,
        updatedAt: true,
        cumulativeInputTokens: true,
        cumulativeOutputTokens: true,
        summarizedCount: true,
        totalCostUsd: true,
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
    db.apiKey.findMany({
      where: { userId },
      select: { provider: true, lastFour: true },
    }),
  ]);

  if (sessions.length === 0) {
    const created = await db.chatSession.create({
      data: { projectId, title: "New Session", order: 0 },
      select: {
        id: true,
        title: true,
        order: true,
        updatedAt: true,
        cumulativeInputTokens: true,
        cumulativeOutputTokens: true,
        summarizedCount: true,
        totalCostUsd: true,
        _count: { select: { messages: true } },
      },
    });
    sessions.push(created);
  }

  const sessionDTOs: ChatSessionDTO[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    updatedAt: s.updatedAt.toISOString(),
    isEmpty: s._count.messages === 0,
    usage: {
      cumulativeInputTokens: s.cumulativeInputTokens,
      cumulativeOutputTokens: s.cumulativeOutputTokens,
      summarizedCount: s.summarizedCount,
      totalCostUsd: s.totalCostUsd,
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
    apiKeys: apiKeys.map((k) => ({ provider: k.provider, lastFour: k.lastFour })),
  };
}

export async function getProjectMessages(sessionId: string) {
  const messages = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return messages;
}
