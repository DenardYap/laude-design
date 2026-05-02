"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function assertProject(projectId: string) {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
  return user;
}

export async function createFolder(projectId: string, name: string, parentId: string | null) {
  await assertProject(projectId);
  const folder = await db.folder.create({
    data: { projectId, name: name.trim() || "New folder", parentId },
    select: { id: true, name: true, parentId: true },
  });
  revalidatePath(`/projects/${projectId}`);
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  const user = await requireUser();
  const folder = await db.folder.findFirst({
    where: { id: folderId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!folder) throw new Error("Folder not found");
  await db.folder.update({
    where: { id: folder.id },
    data: { name: name.trim().slice(0, 80) || "Untitled" },
  });
  revalidatePath(`/projects/${folder.projectId}`);
}

export async function deleteFolder(folderId: string) {
  const user = await requireUser();
  const folder = await db.folder.findFirst({
    where: { id: folderId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!folder) throw new Error("Folder not found");

  // Collect this folder + every descendant folder. The Design.folder relation
  // is `onDelete: SetNull`, which would otherwise orphan the designs to root.
  // The product behaviour is "delete folder and all of its items", so we
  // explicitly delete designs (and cascade their files) before dropping the
  // folder tree.
  const allFolderIds = await collectFolderTree(folder.id);
  await db.$transaction([
    db.design.deleteMany({ where: { folderId: { in: allFolderIds } } }),
    db.folder.delete({ where: { id: folder.id } }),
  ]);
  revalidatePath(`/projects/${folder.projectId}`);
}

async function collectFolderTree(rootId: string): Promise<string[]> {
  const ids: string[] = [rootId];
  let frontier: string[] = [rootId];
  while (frontier.length > 0) {
    const children = await db.folder.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

export async function moveFolder(folderId: string, parentId: string | null) {
  const user = await requireUser();
  const folder = await db.folder.findFirst({
    where: { id: folderId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!folder) throw new Error("Folder not found");
  await db.folder.update({ where: { id: folder.id }, data: { parentId } });
  revalidatePath(`/projects/${folder.projectId}`);
}
