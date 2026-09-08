DELETE FROM application_task_default_language_models
WHERE task = 'chart-spec-generation';

ALTER TYPE application_task
RENAME TO application_task_old;

CREATE TYPE application_task AS ENUM (
  'content-cleaning',
  'message-suggestion',
  'cms-paragraph-suggestion',
  'sisu-description-summary'
);

ALTER TABLE application_task_default_language_models
ALTER COLUMN task TYPE application_task USING task::text::application_task;

DROP TYPE application_task_old;
