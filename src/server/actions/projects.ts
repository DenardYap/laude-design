"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ProjectSchema } from "@/lib/validators";

export async function createProject(input: { name: string }) {
  const user = await requireUser();
  const data = ProjectSchema.parse(input);
  const project = await db.project.create({
    data: { name: data.name, userId: user.id },
  });
  revalidatePath("/projects");
  return { id: project.id };
}

export async function deleteProject(id: string) {
  const user = await requireUser();
  await db.project.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/projects");
}

export async function renameProject(id: string, name: string) {
  const user = await requireUser();
  const data = ProjectSchema.parse({ name });
  await db.project.updateMany({
    where: { id, userId: user.id },
    data: { name: data.name },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}
