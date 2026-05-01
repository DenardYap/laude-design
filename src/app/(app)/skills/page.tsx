import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { SkillUploader } from "@/components/skills/skill-uploader";
import { MySkills } from "@/components/skills/my-skills";
import { PublicSkills } from "@/components/skills/public-skills";

export const metadata = { title: "Skills · Laude Design" };

export default async function SkillsPage() {
  const user = await requireUser();

  const [mine, publicSkills] = await Promise.all([
    db.skill.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        downloads: true,
        updatedAt: true,
      },
    }),
    db.skill.findMany({
      where: { isPublic: true },
      orderBy: [{ downloads: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        downloads: true,
        updatedAt: true,
        user: { select: { name: true } },
      },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Markdown or text files the agent can use as context. Share publicly to help others."
        actions={<SkillUploader />}
      />

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My skills</TabsTrigger>
          <TabsTrigger value="public">Public library</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-4">
          <SearchBar scope="skills:mine" placeholder="Search your skills..." className="max-w-md" />
          <MySkills skills={mine} />
        </TabsContent>

        <TabsContent value="public" className="space-y-4">
          <SearchBar
            scope="skills:public"
            placeholder="Search public skills..."
            className="max-w-md"
          />
          <PublicSkills
            skills={publicSkills.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              downloads: s.downloads,
              updatedAt: s.updatedAt,
              authorName: s.user?.name ?? null,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
