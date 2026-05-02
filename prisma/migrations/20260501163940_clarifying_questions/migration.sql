-- CreateEnum
CREATE TYPE "ClarifyingQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ClarifyingQuestionSet" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "status" "ClarifyingQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ClarifyingQuestionSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClarifyingQuestionSet_sessionId_status_createdAt_idx" ON "ClarifyingQuestionSet"("sessionId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ClarifyingQuestionSet" ADD CONSTRAINT "ClarifyingQuestionSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
