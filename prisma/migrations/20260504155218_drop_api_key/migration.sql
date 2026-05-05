-- Drop the ApiKey table entirely.
-- API keys are no longer stored server-side; they live exclusively in the
-- user's browser (localStorage) and are transmitted per-request over HTTPS.
DROP TABLE IF EXISTS "ApiKey";
