DELETE FROM application_task_default_language_models
WHERE task = 'course-plan-drafting';

ALTER TYPE application_task
RENAME TO application_task_old;

CREATE TYPE application_task AS ENUM (
  'content-cleaning',
  'message-suggestion',
  'cms-paragraph-suggestion',
  'sisu-description-summary',
  'prompt-creation',
  'feedback-categorization',
  'chart-spec-generation',
  'language-version-matching'
);

ALTER TABLE application_task_default_language_models
ALTER COLUMN task TYPE application_task USING task::text::application_task;

DROP TYPE application_task_old;

ALTER TABLE course_designer_plan_stage_tasks DROP COLUMN automatic_check;
DROP TYPE course_designer_automatic_check;

CREATE TYPE course_designer_section_status AS ENUM ('ready', 'unfinished');

COMMENT ON TYPE course_designer_section_status IS 'Whether the plan members consider a section of a stage done.';

CREATE TABLE course_designer_plan_section_statuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_designer_plan_id UUID NOT NULL REFERENCES course_designer_plans(id),
  stage course_designer_stage NOT NULL,
  section_key VARCHAR(255) NOT NULL CHECK (TRIM(section_key) <> ''),
  status course_designer_section_status NOT NULL,
  comment TEXT CHECK (LENGTH(comment) <= 5000),
  updated_by_user_id UUID NOT NULL REFERENCES users(id),
  CONSTRAINT course_designer_plan_section_statuses_section_unique UNIQUE NULLS NOT DISTINCT (
    course_designer_plan_id,
    stage,
    section_key,
    deleted_at
  )
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_designer_plan_section_statuses FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_designer_plan_section_statuses IS 'Ready or unfinished mark, with an optional comment, that plan members set on a section of a stage. A section with no row has not been marked.';
COMMENT ON COLUMN course_designer_plan_section_statuses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_designer_plan_section_statuses.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_designer_plan_section_statuses.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_designer_plan_section_statuses.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_designer_plan_section_statuses.course_designer_plan_id IS 'The plan the section belongs to.';
COMMENT ON COLUMN course_designer_plan_section_statuses.stage IS 'The stage the section belongs to.';
COMMENT ON COLUMN course_designer_plan_section_statuses.section_key IS 'Stable section identifier defined by the frontend forms, such as design.learning_goals. Opaque to the backend.';
COMMENT ON COLUMN course_designer_plan_section_statuses.status IS 'Whether the section is ready or still unfinished.';
COMMENT ON COLUMN course_designer_plan_section_statuses.comment IS 'Optional note about the section, for example what is still missing.';
COMMENT ON COLUMN course_designer_plan_section_statuses.updated_by_user_id IS 'User who last set the status or comment.';
