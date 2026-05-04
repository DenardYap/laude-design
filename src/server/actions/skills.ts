"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  SkillSchema,
  SkillUpdateSchema,
  type SkillInput,
  type SkillUpdateInput,
} from "@/lib/validators";

export async function uploadSkill(input: SkillInput) {
  const user = await requireUser();
  const data = SkillSchema.parse(input);
  const created = await db.skill.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description ?? null,
      content: data.content,
      isPublic: data.isPublic,
      appliedByDefault: true,
    },
    select: { id: true },
  });
  revalidatePath("/skills");
  return { id: created.id };
}

export async function updateSkill(id: string, input: SkillUpdateInput) {
  const user = await requireUser();
  const data = SkillUpdateSchema.parse(input);
  const result = await db.skill.updateMany({
    where: { id, userId: user.id },
    data: {
      name: data.name,
      description: data.description ?? null,
      content: data.content,
    },
  });
  if (result.count === 0) throw new Error("Skill not found or no access");
  revalidatePath("/skills");
  revalidatePath(`/skills/${id}`);
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

/**
 * Clone a public skill into the current user's library. The new copy starts
 * as private + applied-to-every-project so the user immediately benefits
 * from the skill across all of their work.
 *
 * Two layers of idempotency:
 *  - Clone creation: if the user already owns a (non-deleted) clone, return
 *    that clone instead of creating a duplicate — `alreadyAdded` distinguishes
 *    this from a first-time save for the toast/UX.
 *  - Save counter: backed by the SkillSave join table whose composite PK
 *    (skillId, userId) makes "one save per user, ever" a database invariant.
 *    A re-save after the user deleted their clone re-creates the clone but
 *    does NOT bump `Skill.saves` again. The counter is monotonic per user.
 */
export async function addPublicSkillToLibrary(
  originalId: string,
): Promise<{ id: string; alreadyAdded: boolean }> {
  const user = await requireUser();

  const original = await db.skill.findFirst({
    where: { id: originalId, isPublic: true },
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      content: true,
      // Mirrored onto the clone so the user's copy reads as a snapshot of
      // the original's most-recent edit, not the moment of cloning. Without
      // this the clone shows "Updated just now" even though the content has
      // never been touched by the user.
      updatedAt: true,
    },
  });
  if (!original) throw new Error("Skill not found or not public");
  if (original.userId === user.id) {
    throw new Error("You already own this skill");
  }

  const existingClone = await db.skill.findFirst({
    where: { userId: user.id, originalSkillId: originalId },
    select: { id: true },
  });
  if (existingClone) return { id: existingClone.id, alreadyAdded: true };

  const created = await db.$transaction(async (tx) => {
    const copy = await tx.skill.create({
      data: {
        userId: user.id,
        name: original.name,
        description: original.description,
        content: original.content,
        isPublic: false,
        appliedByDefault: true,
        originalSkillId: original.id,
      },
      select: { id: true },
    });

    // Anchor `updatedAt` to the original's last edit so the user's copy
    // reads as a snapshot, not a fresh edit. Done via raw SQL because
    // Prisma's `@updatedAt` decorator can override explicit values passed
    // to `create.data`; a direct UPDATE bypasses that machinery entirely.
    await tx.$executeRaw`UPDATE "Skill" SET "updatedAt" = ${original.updatedAt} WHERE "id" = ${copy.id}`;

    // `createMany` with `skipDuplicates` performs an atomic
    // INSERT … ON CONFLICT DO NOTHING and returns the actual rows inserted.
    // That's race-safe: two concurrent requests can't both observe "not yet
    // saved" and both increment the counter. Only the request that actually
    // wrote the row bumps `saves`.
    const { count } = await tx.skillSave.createMany({
      data: [{ skillId: original.id, userId: user.id }],
      skipDuplicates: true,
    });
    if (count > 0) {
      // Raw SQL on purpose: a normal `tx.skill.update(...)` would trigger
      // `@updatedAt` on the original, making the public skill appear to
      // have been edited every time someone saves it. Counters change
      // metadata, not content — they shouldn't bump the content timestamp.
      await tx.$executeRaw`UPDATE "Skill" SET "saves" = "saves" + 1 WHERE "id" = ${original.id}`;
    }

    return copy;
  });

  revalidatePath("/skills");
  revalidatePath(`/skills/${originalId}`);
  return { id: created.id, alreadyAdded: false };
}

/**
 * Toggle the current user's personal liked state for a public skill.
 *
 * The public-facing `Skill.likes` counter is **monotonic per user** — it
 * increments only the very first time a user likes a skill and never
 * decrements, even on un-like. The personal display state (heart filled
 * vs. outline) is owned by the `SkillLike.active` flag, which is free to
 * flip back and forth.
 *
 * Mechanics:
 *  - First-ever like → `createMany` inserts a new SkillLike row (active=true)
 *    and bumps the counter once. Atomic via the composite PK.
 *  - Un-like → flips the existing row's `active` to false. Counter unchanged.
 *  - Re-like later → flips `active` back to true. Counter still unchanged
 *    because the row already exists.
 */
export async function toggleSkillLike(
  id: string,
): Promise<{ liked: boolean; likes: number }> {
  const user = await requireUser();
  const skill = await db.skill.findFirst({
    where: { id, isPublic: true },
    select: { id: true },
  });
  if (!skill) throw new Error("Skill not found or not public");

  const result = await db.$transaction(async (tx) => {
    // Atomic INSERT … ON CONFLICT DO NOTHING. Tells us whether this is the
    // first time this user has ever liked the skill — the only state in
    // which the public counter should move.
    const { count } = await tx.skillLike.createMany({
      data: [{ skillId: id, userId: user.id }],
      skipDuplicates: true,
    });

    if (count > 0) {
      // Raw SQL on the counter so `@updatedAt` on Skill doesn't fire — likes
      // change metadata, not content. See the matching note in
      // `addPublicSkillToLibrary`.
      const rows = await tx.$queryRaw<Array<{ likes: number }>>`
        UPDATE "Skill" SET "likes" = "likes" + 1 WHERE "id" = ${id} RETURNING "likes"
      `;
      return { liked: true, likes: rows[0]?.likes ?? 0 };
    }

    // Row already exists (this user has liked before, possibly un-liked).
    // Flip `active` to invert the personal state. Counter untouched.
    const existing = await tx.skillLike.findUniqueOrThrow({
      where: { skillId_userId: { skillId: id, userId: user.id } },
      select: { active: true },
    });
    const updated = await tx.skillLike.update({
      where: { skillId_userId: { skillId: id, userId: user.id } },
      data: { active: !existing.active },
      select: { active: true },
    });
    const current = await tx.skill.findUniqueOrThrow({
      where: { id },
      select: { likes: true },
    });
    return { liked: updated.active, likes: current.likes };
  });

  revalidatePath("/skills");
  revalidatePath(`/skills/${id}`);
  return result;
}
