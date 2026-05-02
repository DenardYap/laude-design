-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "appliedByDefault" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProjectSkillOverride" (
    "projectId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL,

    CONSTRAINT "ProjectSkillOverride_pkey" PRIMARY KEY ("projectId","skillId")
);

-- CreateIndex
CREATE INDEX "ProjectSkillOverride_projectId_idx" ON "ProjectSkillOverride"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectSkillOverride" ADD CONSTRAINT "ProjectSkillOverride_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkillOverride" ADD CONSTRAINT "ProjectSkillOverride_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
