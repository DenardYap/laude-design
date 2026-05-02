-- CreateEnum
CREATE TYPE "DesignPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "DesignPlan" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "status" "DesignPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DesignPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignPlan_sessionId_status_createdAt_idx" ON "DesignPlan"("sessionId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "DesignPlan" ADD CONSTRAINT "DesignPlan_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
