ALTER TABLE course_designer_plans
ADD COLUMN great_mooc_vision TEXT CHECK (LENGTH(great_mooc_vision) <= 10000),
  ADD COLUMN created_course_id UUID REFERENCES courses(id);

COMMENT ON COLUMN course_designer_plans.great_mooc_vision IS 'The team''s own description of what would make this MOOC great, written on the plan overview.';
COMMENT ON COLUMN course_designer_plans.created_course_id IS 'The course created from this plan''s course structure. Set once; a plan creates at most one course.';

ALTER TABLE course_designer_plan_members
ADD COLUMN receives_weekly_digest BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN course_designer_plan_members.receives_weekly_digest IS 'Whether this member gets the weekly progress email for this plan. Each member opts out for themselves.';

ALTER TABLE course_designer_plan_stages
ADD COLUMN workspace_revision INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN course_designer_plan_stages.workspace_revision IS 'Incremented on every save of workspace_data. A save names the revision it was based on and is refused when another save happened in between, so members do not overwrite each other.';

ALTER TABLE course_designer_plan_stage_tasks
ADD COLUMN assignee_user_id UUID REFERENCES users(id);

COMMENT ON COLUMN course_designer_plan_stage_tasks.assignee_user_id IS 'Plan member responsible for the task, or NULL when unassigned. Cleared when the member leaves the plan.';

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

ALTER TABLE chatbot_conversations
ADD COLUMN course_designer_plan_id UUID REFERENCES course_designer_plans(id);

CREATE INDEX chatbot_conversations_course_designer_plan_user_created_at_idx ON chatbot_conversations (
  course_designer_plan_id,
  user_id,
  created_at DESC
)
WHERE deleted_at IS NULL
  AND course_designer_plan_id IS NOT NULL;

COMMENT ON COLUMN chatbot_conversations.course_designer_plan_id IS 'The course design plan the conversation is about, when held with the course design assistant; NULL for course chatbots.';

ALTER TABLE chatbot_configurations
ADD COLUMN course_designer_assistant BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX chatbot_configurations_only_one_course_designer_assistant ON chatbot_configurations (course_designer_assistant)
WHERE course_designer_assistant
  AND deleted_at IS NULL;

COMMENT ON COLUMN chatbot_configurations.course_designer_assistant IS 'Whether this chatbot answers on course design plan pages, searching its course as the guide. At most one live configuration has this set.';

-- A new enum value cannot be used in the transaction that adds it, so nothing below may refer to these.
ALTER TYPE chatbot_tool_category
ADD VALUE 'course_planning';

ALTER TYPE email_template_type
ADD VALUE 'course_designer_weekly_digest';
