"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SkillSchema, type SkillInput } from "@/lib/validators";

export async function uploadSkill(input: SkillInput) {
  const user = await requireUser();
  const data = SkillSchema.parse(input);
  await db.skill.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description ?? null,
      content: data.content,
      isPublic: data.isPublic,
    },
  });
  revalidatePath("/skills");
}

export async function toggleSkillPublic(id: string, isPublic: boolean) {
  const user = await requireUser();
  await db.skill.updateMany({
    where: { id, userId: user.id },
    data: { isPublic },
  });
  revalidatePath("/skills");
}

export async function deleteSkill(id: string) {
  const user = await requireUser();
  await db.skill.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/skills");
}

export async function downloadPublicSkill(id: string) {
  await requireUser();
  const skill = await db.skill.findFirst({
    where: { id, isPublic: true },
    select: { name: true, content: true },
  });
  if (!skill) throw new Error("Skill not found or not public");
  await db.skill.update({ where: { id }, data: { downloads: { increment: 1 } } });
  revalidatePath("/skills");
  const filename = `${skill.name.replace(/[^\w.-]+/g, "_")}.md`;
  return { filename, content: skill.content };
}
