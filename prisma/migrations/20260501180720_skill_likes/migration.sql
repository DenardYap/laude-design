-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "likes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SkillLike" (
    "skillId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillLike_pkey" PRIMARY KEY ("skillId","userId")
);

-- CreateIndex
CREATE INDEX "SkillLike_userId_idx" ON "SkillLike"("userId");

-- AddForeignKey
ALTER TABLE "SkillLike" ADD CONSTRAINT "SkillLike_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillLike" ADD CONSTRAINT "SkillLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
