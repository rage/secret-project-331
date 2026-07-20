-- No lower bound existed before this migration, so existing rows may hold max_output_tokens below
-- the new floor (the column default was 600 and it was backfilled from the old
-- response_max_tokens/max_completion_tokens columns, which were unconstrained). Postgres validates a
-- new CHECK against all existing rows at ADD CONSTRAINT time, so any such row would abort the
-- migration and block the deploy. Clamp them up to the new floor first; this is idempotent.
UPDATE chatbot_configurations
SET max_output_tokens = 10000
WHERE max_output_tokens < 10000;

-- Align the column default with the application default (ChatbotConfiguration::default) so a row
-- inserted without an explicit value cannot violate the constraint below.
ALTER TABLE chatbot_configurations
ALTER COLUMN max_output_tokens SET DEFAULT 20000;

ALTER TABLE chatbot_configurations
ADD CONSTRAINT chatbot_configurations_max_output_tokens_min CHECK (max_output_tokens >= 10000);
