-- CreateTable
CREATE TABLE "SkillSave" (
    "skillId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillSave_pkey" PRIMARY KEY ("skillId", "userId")
);

-- CreateIndex
CREATE INDEX "SkillSave_userId_idx" ON "SkillSave"("userId");

-- AddForeignKey
ALTER TABLE "SkillSave" ADD CONSTRAINT "SkillSave_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillSave" ADD CONSTRAINT "SkillSave_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing clone implies its owner has saved the original.
-- We deduplicate via ON CONFLICT (composite PK guards uniqueness) and skip
-- the (impossible-by-app-rules but defensively-handled) case where someone
-- somehow owns a clone of their own skill.
INSERT INTO "SkillSave" ("skillId", "userId", "createdAt")
SELECT clone."originalSkillId", clone."userId", clone."createdAt"
FROM "Skill" clone
JOIN "Skill" original ON original."id" = clone."originalSkillId"
WHERE clone."originalSkillId" IS NOT NULL
  AND clone."userId" <> original."userId"
ON CONFLICT DO NOTHING;

-- Re-derive both denormalized counters from the join tables. This collapses
-- any historical inflation from the old toggle-able likes and the (now
-- fixed) re-save bug into accurate per-user counts. Safe to run on an empty
-- public library: COUNT(*) → 0 → no-op update.
UPDATE "Skill"
SET "saves" = COALESCE((
  SELECT COUNT(*) FROM "SkillSave" WHERE "SkillSave"."skillId" = "Skill"."id"
), 0);

UPDATE "Skill"
SET "likes" = COALESCE((
  SELECT COUNT(*) FROM "SkillLike" WHERE "SkillLike"."skillId" = "Skill"."id"
), 0);
