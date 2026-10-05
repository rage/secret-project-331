DELETE FROM application_task_default_language_models
WHERE task = 'feedback-categorization';

ALTER TYPE application_task
RENAME TO application_task_old;

CREATE TYPE application_task AS ENUM (
  'chart-spec-generation',
  'content-cleaning',
  'message-suggestion',
  'cms-paragraph-suggestion',
  'sisu-description-summary',
  'prompt-creation'
);

ALTER TABLE application_task_default_language_models
ALTER COLUMN task TYPE application_task USING task::text::application_task;

DROP TYPE application_task_old;
