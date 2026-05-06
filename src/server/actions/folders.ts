"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertWithinLimit } from "@/lib/limits";

async function assertProject(projectId: string) {
  const user = await requireUser();
  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
  return user;
}

/**
 * Returns the names of all folders and designs that are direct children of
 * `parentId` within the project, optionally excluding a specific folder id
 * (used when checking rename conflicts against siblings, excluding self).
 */
async function siblingNames(
  projectId: string,
  parentId: string | null,
  excludeFolderId?: string,
): Promise<string[]> {
  const [folders, designs] = await Promise.all([
    db.folder.findMany({
      where: {
        projectId,
        parentId,
        ...(excludeFolderId ? { id: { not: excludeFolderId } } : {}),
      },
      select: { name: true },
    }),
    db.design.findMany({
      where: { projectId, folderId: parentId },
      select: { name: true },
    }),
  ]);
  return [...folders, ...designs].map((x) => x.name);
}

/**
 * Returns `base` if it is not already present in `existing` (case-insensitive),
 * otherwise appends ` (1)`, ` (2)`, … until a free slot is found.
 */
function makeUniqueName(base: string, existing: string[]): string {
  const lower = existing.map((n) => n.toLowerCase());
  if (!lower.includes(base.toLowerCase())) return base;
  let n = 1;
  while (lower.includes(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

export async function createFolder(
  projectId: string,
  name: string,
  parentId: string | null,
) {
  const user = await assertProject(projectId);
  await assertWithinLimit(user.id, "folders");
  const base = name.trim() || "New folder";
  const existing = await siblingNames(projectId, parentId);
  const uniqueName = makeUniqueName(base, existing);
  const folder = await db.folder.create({
    data: { projectId, name: uniqueName, parentId },
    select: { id: true, name: true, parentId: true },
  });
  revalidatePath(`/projects/${projectId}`);
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  const user = await requireUser();
  const folder = await db.folder.findFirst({
    where: { id: folderId, project: { userId: user.id } },
    select: { id: true, projectId: true, parentId: true },
  });
  if (!folder) throw new Error("Folder not found");

  const trimmed = name.trim().slice(0, 80) || "Untitled";
  const existing = await siblingNames(folder.projectId, folder.parentId, folderId);
  if (existing.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())) {
    throw new Error(`"${trimmed}" already exists in this folder`);
  }

  await db.folder.update({
    where: { id: folder.id },
    data: { name: trimmed },
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
    select: { id: true, projectId: true, name: true },
  });
  if (!folder) throw new Error("Folder not found");

  // Auto-deduplicate name at the destination level.
  const existing = await siblingNames(folder.projectId, parentId, folderId);
  const finalName = makeUniqueName(folder.name, existing);

  await db.folder.update({
    where: { id: folder.id },
    data: { parentId, ...(finalName !== folder.name ? { name: finalName } : {}) },
  });
  revalidatePath(`/projects/${folder.projectId}`);
}
