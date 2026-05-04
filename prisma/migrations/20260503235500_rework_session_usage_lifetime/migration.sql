-- Drop the per-turn output snapshot column — replaced by lifetime
-- `cumulativeOutputTokens` (already tracked) for the popover's Output line.
ALTER TABLE "ChatSession" DROP COLUMN "lastOutputTokens";

-- Track tokens summarized away over the session lifetime so the popover's
-- "All tokens" line can show "what the conversation would weigh if we never
-- summarized" — i.e. lastInputTokens + cumulativeFoldedTokens.
ALTER TABLE "ChatSession" ADD COLUMN "cumulativeFoldedTokens" INTEGER NOT NULL DEFAULT 0;
