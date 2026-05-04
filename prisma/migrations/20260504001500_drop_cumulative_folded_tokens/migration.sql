-- The popover's "All tokens" row was removed (it duplicated "Input tokens"
-- pre-summarization). The folded-token counter that backed it is now
-- unused, so drop the column rather than leave dead state in the schema.
ALTER TABLE "ChatSession" DROP COLUMN "cumulativeFoldedTokens";
