import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { SkillUploader } from "@/components/skills/skill-uploader";
import { MySkillsTable } from "@/components/skills/my-skills-table";
import { PublicSkillsTable } from "@/components/skills/public-skills-table";

export const metadata = { title: "Skills · Laude Design" };

export default function SkillsPage() {
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
          <MySkillsTable />
        </TabsContent>

        <TabsContent value="public">
          <PublicSkillsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
