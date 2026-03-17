CREATE TYPE course_designer_stage AS ENUM (
  'analysis',
  'design',
  'development',
  'implementation',
  'evaluation'
);
COMMENT ON TYPE course_designer_stage IS 'Fixed stage identifiers for the hardcoded MOOC course design workflow.';

CREATE TYPE course_designer_plan_status AS ENUM (
  'draft',
  'scheduling',
  'ready_to_start',
  'in_progress',
  'completed',
  'archived'
);
COMMENT ON TYPE course_designer_plan_status IS 'Overall lifecycle status for a MOOC course design plan.';

CREATE TYPE course_designer_plan_stage_status AS ENUM (
  'not_started',
  'in_progress',
  'completed'
);
COMMENT ON TYPE course_designer_plan_stage_status IS 'Manual progress status for a single stage within a MOOC course design plan.';

CREATE TABLE course_designer_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255),
  STATUS course_designer_plan_status NOT NULL DEFAULT 'draft',
  active_stage course_designer_stage,
  last_weekly_stage_email_sent_at TIMESTAMP WITH TIME ZONE,
  CHECK (
    name IS NULL
    OR TRIM(name) <> ''
  ),
  CHECK (
    STATUS <> 'in_progress'
    OR active_stage IS NOT NULL
  )
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_designer_plans FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_designer_plans IS 'A collaborative plan used to design a MOOC course over multiple months.';
COMMENT ON COLUMN course_designer_plans.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_designer_plans.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_designer_plans.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_designer_plans.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_designer_plans.created_by_user_id IS 'User who created the plan.';
COMMENT ON COLUMN course_designer_plans.name IS 'Optional user-provided name for the plan.';
COMMENT ON COLUMN course_designer_plans.status IS 'Overall workflow status of the plan.';
COMMENT ON COLUMN course_designer_plans.active_stage IS 'Stage currently active in the UI. This is manually transitioned by the user.';
COMMENT ON COLUMN course_designer_plans.last_weekly_stage_email_sent_at IS 'Timestamp when the latest weekly stage reminder email was sent to plan members.';

CREATE TABLE course_designer_plan_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_designer_plan_id UUID NOT NULL REFERENCES course_designer_plans(id),
  user_id UUID NOT NULL REFERENCES users(id),
  CONSTRAINT course_designer_plan_members_plan_user_unique UNIQUE NULLS NOT DISTINCT (
    course_designer_plan_id,
    user_id,
    deleted_at
  )
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_designer_plan_members FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX course_designer_plan_members_user_id_idx ON course_designer_plan_members (user_id, deleted_at);

COMMENT ON TABLE course_designer_plan_members IS 'Users who can access and collaborate on a MOOC course design plan.';
COMMENT ON COLUMN course_designer_plan_members.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_designer_plan_members.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_designer_plan_members.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_designer_plan_members.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_designer_plan_members.course_designer_plan_id IS 'The plan the member belongs to.';
COMMENT ON COLUMN course_designer_plan_members.user_id IS 'A user with access to the plan. All active members receive weekly stage reminder emails.';

CREATE TABLE course_designer_plan_stages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_designer_plan_id UUID NOT NULL REFERENCES course_designer_plans(id),
  stage course_designer_stage NOT NULL,
  STATUS course_designer_plan_stage_status NOT NULL DEFAULT 'not_started',
  planned_starts_on DATE NOT NULL,
  planned_ends_on DATE NOT NULL,
  actual_started_at TIMESTAMP WITH TIME ZONE,
  actual_completed_at TIMESTAMP WITH TIME ZONE,
  CHECK (planned_starts_on <= planned_ends_on),
  CHECK (
    actual_started_at IS NULL
    OR actual_completed_at IS NULL
    OR actual_started_at <= actual_completed_at
  ),
  CONSTRAINT course_designer_plan_stages_plan_stage_unique UNIQUE NULLS NOT DISTINCT (
    course_designer_plan_id,
    stage,
    deleted_at
  )
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_designer_plan_stages FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_designer_plan_stages IS 'Per-plan stage schedule and actual progress data for the fixed MOOC course design stages.';
COMMENT ON COLUMN course_designer_plan_stages.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_designer_plan_stages.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_designer_plan_stages.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_designer_plan_stages.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_designer_plan_stages.course_designer_plan_id IS 'The plan this stage schedule row belongs to.';
COMMENT ON COLUMN course_designer_plan_stages.stage IS 'Which fixed workflow stage this row represents.';
COMMENT ON COLUMN course_designer_plan_stages.status IS 'Manual progress status for the stage.';
COMMENT ON COLUMN course_designer_plan_stages.planned_starts_on IS 'Planned start date for this stage.';
COMMENT ON COLUMN course_designer_plan_stages.planned_ends_on IS 'Planned end date for this stage.';
COMMENT ON COLUMN course_designer_plan_stages.actual_started_at IS 'Timestamp when work on this stage actually started.';
COMMENT ON COLUMN course_designer_plan_stages.actual_completed_at IS 'Timestamp when this stage was marked completed.';

CREATE TABLE course_designer_plan_stage_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_designer_plan_stage_id UUID NOT NULL REFERENCES course_designer_plan_stages(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  order_number INTEGER NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by_user_id UUID REFERENCES users(id),
  is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID REFERENCES users(id),
  CHECK (TRIM(title) <> ''),
  CHECK (order_number > 0),
  CHECK (
    completed_at IS NULL
    OR is_completed = TRUE
  ),
  CHECK (
    completed_by_user_id IS NULL
    OR is_completed = TRUE
  ),
  CONSTRAINT course_designer_plan_stage_tasks_stage_order_unique UNIQUE NULLS NOT DISTINCT (
    course_designer_plan_stage_id,
    order_number,
    deleted_at
  )
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_designer_plan_stage_tasks FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_designer_plan_stage_tasks IS 'Tasks belonging to a specific stage in a MOOC course design plan.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.course_designer_plan_stage_id IS 'The stage row this task belongs to.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.title IS 'Task title shown in the stage task list.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.description IS 'Optional task description.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.order_number IS 'Display order of the task within the stage.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.is_completed IS 'Whether the task has been marked completed.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.completed_at IS 'Timestamp when the task was marked completed.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.completed_by_user_id IS 'User who marked the task completed.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.is_auto_generated IS 'Whether the task was generated by the system instead of created manually.';
COMMENT ON COLUMN course_designer_plan_stage_tasks.created_by_user_id IS 'User who created the task, or NULL for automatically generated tasks.';

CREATE TABLE course_designer_plan_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_designer_plan_id UUID NOT NULL REFERENCES course_designer_plans(id),
  actor_user_id UUID REFERENCES users(id),
  event_type VARCHAR(255) NOT NULL,
  stage course_designer_stage,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (TRIM(event_type) <> '')
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_designer_plan_events FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX course_designer_plan_events_timeline_idx ON course_designer_plan_events (
  course_designer_plan_id,
  deleted_at,
  occurred_at DESC
);

COMMENT ON TABLE course_designer_plan_events IS 'Append-only event log for reconstructing a design plan timeline and auditing changes.';
COMMENT ON COLUMN course_designer_plan_events.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_designer_plan_events.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_designer_plan_events.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_designer_plan_events.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_designer_plan_events.course_designer_plan_id IS 'The plan this event belongs to.';
COMMENT ON COLUMN course_designer_plan_events.actor_user_id IS 'User who caused the event, or NULL for system-generated events.';
COMMENT ON COLUMN course_designer_plan_events.event_type IS 'Application-defined event type identifier.';
COMMENT ON COLUMN course_designer_plan_events.stage IS 'Optional workflow stage associated with the event.';
COMMENT ON COLUMN course_designer_plan_events.payload IS 'Event-specific structured data used to reconstruct timeline details.';
COMMENT ON COLUMN course_designer_plan_events.occurred_at IS 'When the event occurred. May differ from created_at when backfilling events.';
