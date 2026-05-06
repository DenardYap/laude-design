import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { auth, requireUser } from "@/lib/auth";
import { MySkillDetail } from "@/components/skills/my-skill-detail";
import { PublicSkillDetail } from "@/components/skills/public-skill-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  // a private skill is only visible to its creator
  const session = await auth();
  if (!session?.user?.id) return { title: "Skill · Laude Design" };
  const { id } = await params;
  const skill = await db.skill.findFirst({
    where: {
      id,
      OR: [{ userId: session.user.id }, { isPublic: true }],
    },
    select: { name: true },
  });
  return { title: skill ? `${skill.name} · Skills · Laude Design` : "Skill · Laude Design" };
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const skill = await db.skill.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      content: true,
      isPublic: true,
      appliedByDefault: true,
      saves: true,
      likes: true,
      originalSkillId: true,
      updatedAt: true,
      user: { select: { name: true, image: true } },
      originalSkill: { select: { id: true, name: true, isPublic: true } },
      _count: { select: { overrides: true } },
      likedBy: {
        where: { userId: user.id },
        select: { userId: true, active: true },
        take: 1,
      },
    },
  });

  if (!skill) notFound();

  const isOwner = skill.userId === user.id;
  if (!isOwner && !skill.isPublic) notFound();

  if (isOwner) {
    return (
      <MySkillDetail
        skill={{
          id: skill.id,
          name: skill.name,
          description: skill.description,
          content: skill.content,
          isPublic: skill.isPublic,
          appliedByDefault: skill.appliedByDefault,
          overrideCount: skill._count.overrides,
          saves: skill.saves,
          likes: skill.likes,
          updatedAt: skill.updatedAt,
          clonedFrom: skill.originalSkill,
        }}
      />
    );
  }

  const existingCopy = await db.skill.findFirst({
    where: { userId: user.id, originalSkillId: skill.id },
    select: { id: true },
  });

  // Only surface the "cloned from" link when the original is reachable 
  const clonedFrom =
    skill.originalSkill && skill.originalSkill.isPublic
      ? { id: skill.originalSkill.id, name: skill.originalSkill.name }
      : null;

  return (
    <PublicSkillDetail
      skill={{
        id: skill.id,
        name: skill.name,
        description: skill.description,
        content: skill.content,
        saves: skill.saves,
        likes: skill.likes,
        likedByMe: skill.likedBy[0]?.active === true,
        updatedAt: skill.updatedAt,
        authorName: skill.user?.name ?? null,
        authorImage: skill.user?.image ?? null,
        existingCopyId: existingCopy?.id ?? null,
        clonedFrom,
      }}
    />
  );
}
