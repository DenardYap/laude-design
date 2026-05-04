-- Re-add the folded-tokens counter, this time to back the popover's
-- "Input tokens" row (= lastInputTokens + cumulativeFoldedTokens) so the
-- value never decreases when rolling summarization shrinks the live prompt.
ALTER TABLE "ChatSession" ADD COLUMN "cumulativeFoldedTokens" INTEGER NOT NULL DEFAULT 0;
