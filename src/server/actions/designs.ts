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

export async function createDesign(
  projectId: string,
  input: { name?: string; folderId?: string | null } = {},
) {
  await assertProject(projectId);
  const design = await db.design.create({
    data: {
      projectId,
      folderId: input.folderId ?? null,
      name: input.name?.trim() || "Untitled design",
    },
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
    select: { id: true, projectId: true },
  });
  if (!design) throw new Error("Design not found");
  await db.design.update({
    where: { id: design.id },
    data: { name: name.trim().slice(0, 80) || "Untitled design" },
  });
  revalidatePath(`/projects/${design.projectId}`);
}

export async function moveDesign(designId: string, folderId: string | null) {
  const user = await requireUser();
  const design = await db.design.findFirst({
    where: { id: designId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!design) throw new Error("Design not found");
  await db.design.update({ where: { id: design.id }, data: { folderId } });
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
