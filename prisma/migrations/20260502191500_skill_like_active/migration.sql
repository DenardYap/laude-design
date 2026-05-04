-- AlterTable
-- All existing likes count as currently-active (no historical un-likes to
-- preserve since the prior toggleSkillLike implementation deleted rows on
-- unlike, so anything still in the table is by definition an active like).
ALTER TABLE "SkillLike" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
