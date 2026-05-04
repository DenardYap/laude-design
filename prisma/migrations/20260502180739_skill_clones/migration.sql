-- AlterTable
ALTER TABLE "Skill" ADD COLUMN "originalSkillId" TEXT;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_originalSkillId_fkey" FOREIGN KEY ("originalSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Skill_userId_originalSkillId_idx" ON "Skill"("userId", "originalSkillId");
