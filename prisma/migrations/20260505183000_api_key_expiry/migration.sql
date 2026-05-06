-- Add an optional auto-expiry timestamp to ApiKey rows. NULL keeps the
-- existing "never expires" behaviour for keys that were saved before this
-- column existed.
ALTER TABLE "ApiKey" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Index for cheap lookups by expiry (cleanup sweep, future cron).
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");
