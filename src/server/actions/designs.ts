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

/**
 * Returns the names of all folders and designs that are direct children of
 * `folderId` within the project, optionally excluding a specific design id
 * (used when checking rename conflicts against siblings, excluding self).
 */
async function siblingNames(
  projectId: string,
  folderId: string | null,
  excludeDesignId?: string,
): Promise<string[]> {
  const [folders, designs] = await Promise.all([
    db.folder.findMany({
      where: { projectId, parentId: folderId },
      select: { name: true },
    }),
    db.design.findMany({
      where: {
        projectId,
        folderId,
        ...(excludeDesignId ? { id: { not: excludeDesignId } } : {}),
      },
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

export async function createDesign(
  projectId: string,
  input: { name?: string; folderId?: string | null } = {},
) {
  await assertProject(projectId);
  const base = input.name?.trim() || "Untitled design";
  const folderId = input.folderId ?? null;
  const existing = await siblingNames(projectId, folderId);
  const uniqueName = makeUniqueName(base, existing);

  const design = await db.design.create({
    data: { projectId, folderId, name: uniqueName },
    include: { files: { select: { path: true, content: true } } },
  });
  revalidatePath(`/projects/${projectId}`);
  return {
    id: design.id,
    name: design.name,
    folderId: design.folderId,
    files: design.files,
    updatedAt: design.updatedAt.toISOString(),
  };
}

export async function renameDesign(designId: string, name: string) {
  const user = await requireUser();
  const design = await db.design.findFirst({
    where: { id: designId, project: { userId: user.id } },
    select: { id: true, projectId: true, folderId: true },
  });
  if (!design) throw new Error("Design not found");

  const trimmed = name.trim().slice(0, 80) || "Untitled design";
  const existing = await siblingNames(design.projectId, design.folderId, designId);
  if (existing.map((n) => n.toLowerCase()).includes(trimmed.toLowerCase())) {
    throw new Error(`"${trimmed}" already exists in this folder`);
  }

  await db.design.update({
    where: { id: design.id },
    data: { name: trimmed },
  });
  revalidatePath(`/projects/${design.projectId}`);
}

export async function moveDesign(designId: string, folderId: string | null) {
  const user = await requireUser();
  const design = await db.design.findFirst({
    where: { id: designId, project: { userId: user.id } },
    select: { id: true, projectId: true, name: true },
  });
  if (!design) throw new Error("Design not found");

  // Auto-deduplicate name at the destination level.
  const existing = await siblingNames(design.projectId, folderId, designId);
  const finalName = makeUniqueName(design.name, existing);

  await db.design.update({
    where: { id: design.id },
    data: { folderId, ...(finalName !== design.name ? { name: finalName } : {}) },
  });
  revalidatePath(`/projects/${design.projectId}`);
}

export async function deleteDesign(designId: string) {
  const user = await requireUser();
  const design = await db.design.findFirst({
    where: { id: designId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!design) throw new Error("Design not found");
  await db.design.delete({ where: { id: design.id } });
  revalidatePath(`/projects/${design.projectId}`);
}
