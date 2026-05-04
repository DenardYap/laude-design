import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { SkillUploader } from "@/components/skills/skill-uploader";
import { MySkillsTable } from "@/components/skills/my-skills-table";
import { PublicSkillsTable } from "@/components/skills/public-skills-table";

export const metadata = { title: "Skills · Laude Design" };

export default async function SkillsPage() {
  const user = await requireUser();

  const [mine, publicSkills] = await Promise.all([
    db.skill.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      // Hard ceiling so a runaway library never DoSes the page render. The
      // table paginates client-side over whatever we return; if a single user
      // ever reaches the cap we'll need to switch to server-driven paging.
      take: 500,
      select: {
        id: true,
        name: true,
        description: true,
        content: true,
        isPublic: true,
        appliedByDefault: true,
        updatedAt: true,
        // Provenance for cloned skills. `originalSkill` is null when the user
        // authored the skill from scratch, in which case the row's Author cell
        // reads "you".
        originalSkill: { select: { user: { select: { name: true } } } },
      },
    }),
    db.skill.findMany({
      where: { isPublic: true },
      // Default sort by saves so the popular library lands first; the table
      // exposes a sort menu to override this client-side.
      orderBy: [{ saves: "desc" }, { updatedAt: "desc" }],
      // Same client-side pagination model as `mine`. 500 is the soft cap on
      // how big the public library can grow before we have to move filtering,
      // sorting, and pagination to the server.
      take: 500,
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        content: true,
        saves: true,
        likes: true,
        updatedAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Markdown or text files the agent can use as context. Click a skill to edit or share it."
        actions={<SkillUploader />}
      />

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My skills</TabsTrigger>
          <TabsTrigger value="public">Public library</TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <MySkillsTable
            skills={mine.map(({ content, originalSkill, ...s }) => ({
              ...s,
              charCount: content.length,
              authorName: originalSkill?.user?.name ?? null,
              isClone: originalSkill !== null,
            }))}
          />
        </TabsContent>

        <TabsContent value="public">
          <PublicSkillsTable
            skills={publicSkills.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              charCount: s.content.length,
              saves: s.saves,
              likes: s.likes,
              updatedAt: s.updatedAt,
              authorName: s.user?.name ?? null,
              isMine: s.userId === user.id,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
