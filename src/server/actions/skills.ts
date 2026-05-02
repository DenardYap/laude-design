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
      appliedByDefault: true,
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

export async function setSkillAppliedByDefault(id: string, applied: boolean) {
  const user = await requireUser();
  await db.skill.updateMany({
    where: { id, userId: user.id },
    data: { appliedByDefault: applied },
  });
  revalidatePath("/skills");
}

export async function setProjectSkillEffective(
  projectId: string,
  skillId: string,
  applied: boolean,
) {
  const user = await requireUser();

  const [project, skill] = await Promise.all([
    db.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } }),
    db.skill.findFirst({
      where: { id: skillId, userId: user.id },
      select: { appliedByDefault: true },
    }),
  ]);
  if (!project) throw new Error("Project not found or no access");
  if (!skill) throw new Error("Skill not found or no access");

  if (applied === skill.appliedByDefault) {
    await db.projectSkillOverride.deleteMany({ where: { projectId, skillId } });
  } else {
    await db.projectSkillOverride.upsert({
      where: { projectId_skillId: { projectId, skillId } },
      create: { projectId, skillId, applied },
      update: { applied },
    });
  }
}

export async function clearSkillOverrides(skillId: string) {
  const user = await requireUser();
  const skill = await db.skill.findFirst({
    where: { id: skillId, userId: user.id },
    select: { id: true },
  });
  if (!skill) throw new Error("Skill not found or no access");
  await db.projectSkillOverride.deleteMany({ where: { skillId } });
  revalidatePath("/skills");
}

export interface ProjectSkillState {
  id: string;
  name: string;
  description: string | null;
  appliedByDefault: boolean;
  overrideApplied: boolean | null;
  effective: boolean;
}

export async function getProjectSkillStates(projectId: string): Promise<ProjectSkillState[]> {
  const user = await requireUser();

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found or no access");

  const skills = await db.skill.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      appliedByDefault: true,
      overrides: {
        where: { projectId },
        select: { applied: true },
        take: 1,
      },
    },
  });

  return skills.map((s) => {
    const override = s.overrides[0] ?? null;
    const effective = override !== null ? override.applied : s.appliedByDefault;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      appliedByDefault: s.appliedByDefault,
      overrideApplied: override?.applied ?? null,
      effective,
    };
  });
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

export async function toggleSkillLike(id: string): Promise<{ liked: boolean; likes: number }> {
  const user = await requireUser();
  const skill = await db.skill.findFirst({
    where: { id, isPublic: true },
    select: { id: true },
  });
  if (!skill) throw new Error("Skill not found or not public");

  const existing = await db.skillLike.findUnique({
    where: { skillId_userId: { skillId: id, userId: user.id } },
    select: { skillId: true },
  });

  const updated = await db.$transaction(async (tx) => {
    if (existing) {
      await tx.skillLike.delete({
        where: { skillId_userId: { skillId: id, userId: user.id } },
      });
      return tx.skill.update({
        where: { id },
        data: { likes: { decrement: 1 } },
        select: { likes: true },
      });
    }
    await tx.skillLike.create({ data: { skillId: id, userId: user.id } });
    return tx.skill.update({
      where: { id },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    });
  });

  revalidatePath("/skills");
  return { liked: !existing, likes: Math.max(0, updated.likes) };
}
