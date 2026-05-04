import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { auth, requireUser } from "@/lib/auth";
import { MySkillDetail } from "@/components/skills/my-skill-detail";
import { PublicSkillDetail } from "@/components/skills/public-skill-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  // Mirrors the page-level authz on line ~52: a private skill is only
  // visible to its creator. Without filtering here, the skill `name` would
  // still leak into the browser tab <title> for any logged-in user who
  // probed a private skill ID.
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
      // `isPublic` filters whether we surface a link on the public viewer
      // (we won't link to a skill the viewer can't access). For the owner
      // view we still want to show provenance regardless of whether the
      // original is currently public, so we pull both fields.
      originalSkill: { select: { id: true, name: true, isPublic: true } },
      _count: { select: { overrides: true } },
      likedBy: {
        where: { userId: user.id },
        // Active flag captures whether *this* user currently considers the
        // skill liked. The row may exist but be inactive (un-liked) — in
        // which case the heart should render unfilled.
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
          // Surfaces the "From the public library" badge on the detail page.
          // null when the skill was authored from scratch by the user.
          clonedFrom: skill.originalSkill,
        }}
      />
    );
  }

  // Viewer is a non-owner looking at a public skill. Look up whether they
  // already have a copy of this skill so we can show "Open my copy" instead
  // of "Add to my Skills". This is a tiny indexed lookup, not a join.
  const existingCopy = await db.skill.findFirst({
    where: { userId: user.id, originalSkillId: skill.id },
    select: { id: true },
  });

  // Only surface the "cloned from" link when the original is reachable —
  // i.e. it still exists (originalSkill non-null) and is still public so
  // the viewer can actually navigate to it. A deleted or now-private
  // original silently drops the link rather than dangling.
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
