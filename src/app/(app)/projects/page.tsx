import { FolderKanban } from "lucide-react";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectList } from "@/components/projects/project-list";
import { SearchBar } from "@/components/shared/search-bar";
import { MultiSelectFilter } from "@/components/shared/multi-select-filter";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Projects · Laude Design" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CreateProjectDialog />
      </div>

      <div className="flex items-center justify-center gap-3">
        <SearchBar scope="projects" placeholder="Search projects..." className="w-full max-w-md" />
        <MultiSelectFilter
          scope="projects"
          options={[
            { value: "claude", label: "Laude" },
            { value: "openai", label: "OpenAI" },
            { value: "gemini", label: "Gemini" },
          ]}
          showAsIcon
          label="Filter by model"
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-10" />}
          title="No projects yet"
          description="Create your first project to start designing with your favorite model."
          action={<CreateProjectDialog />}
        />
      ) : (
        <ProjectList projects={projects} />
      )}
    </div>
  );
}
