import { FolderKanban } from "lucide-react";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectList } from "@/components/projects/project-list";
import { SearchBar } from "@/components/shared/search-bar";
import { MultiSelectFilter } from "@/components/shared/multi-select-filter";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Projects · Laude Design" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader
        title="Projects"
        description="Open a project to start designing with your favorite model."
        actions={<CreateProjectDialog />}
      />

      <div className="flex items-center gap-2">
        <SearchBar
          scope="projects"
          placeholder="Search projects..."
          className="flex-1"
        />
        <MultiSelectFilter
          scope="projects"
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
            { value: "older", label: "Older" },
          ]}
          showAsIcon
          label="Filter by last updated"
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-10" />}
          title="No projects yet"
          description="Projects bundle your designs, chat sessions, and uploaded files. Create one to start."
          action={<CreateProjectDialog />}
        />
      ) : (
        <ProjectList projects={projects} />
      )}
    </div>
  );
}
