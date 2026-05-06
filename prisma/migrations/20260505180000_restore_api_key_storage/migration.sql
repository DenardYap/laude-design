-- Roll back the abandoned wrap-key experiment, then re-create the encrypted
-- ApiKey table that was dropped earlier in the same dev cycle. The init
-- migration originally provisioned ApiKey, so production deployments that
-- never went through the drop have nothing to do here in practice.
DROP TABLE IF EXISTS "ApiKeyWrap";

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_userId_provider_key" ON "ApiKey"("userId", "provider");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
