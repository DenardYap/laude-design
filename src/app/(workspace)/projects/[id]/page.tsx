import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkspaceData } from "@/lib/workspace/queries";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { name: true } });
  return { title: project ? `${project.name} · Laude Design` : "Project · Laude Design" };
}

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;
  const data = await getWorkspaceData(id, session.user.id);
  if (!data) notFound();

  const projects = await db.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <ProjectWorkspace
      project={data.project}
      sessions={data.sessions}
      folders={data.folders}
      designs={data.designs}
      apiKeys={data.apiKeys}
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
      allProjects={projects}
    />
  );
}
