import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDesktopUserAgent } from "@/lib/server-viewport";
import { getWorkspaceData } from "@/lib/workspace/queries";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  // Ownership-scoped lookup. Without this filter, a logged-in user (or even
  // an unauthenticated visitor, since `findUnique` doesn't care) could
  // probe arbitrary project IDs and read back the project name in the
  // <title> tag — a low-impact but real cross-tenant info leak. The data
  // page below still does the full ownership check + 404, so this only
  // affects the browser tab title.
  const session = await auth();
  if (!session?.user?.id) return { title: "Project · Laude Design" };
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    select: { name: true },
  });
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

  const [projects, ssrIsDesktop] = await Promise.all([
    db.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
    isDesktopUserAgent(),
  ]);

  return (
    <ProjectWorkspace
      project={data.project}
      sessions={data.sessions}
      folders={data.folders}
      designs={data.designs}
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
      allProjects={projects}
      ssrIsDesktop={ssrIsDesktop}
    />
  );
}
