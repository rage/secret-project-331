DELETE FROM application_task_default_language_models
WHERE task = 'cms-paragraph-suggestion';

ALTER TYPE application_task
RENAME TO application_task_old;

CREATE TYPE application_task AS ENUM ('content-cleaning', 'message-suggestion');

ALTER TABLE application_task_default_language_models
ALTER COLUMN task TYPE application_task USING task::text::application_task;

DROP TYPE application_task_old;
