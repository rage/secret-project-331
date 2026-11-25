CREATE TABLE teacher_newsletter_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_exercises_count BIGINT NOT NULL,
  completed_course_count BIGINT NOT NULL,
  started_course_count BIGINT NOT NULL,
  flagged_cheaters_count_period BIGINT NOT NULL,
  flagged_cheaters_count_total BIGINT NOT NULL,
  unread_feedback_count_period BIGINT NOT NULL,
  unread_feedback_count_total BIGINT NOT NULL,
  proposal_count_period BIGINT NOT NULL,
  proposal_count_total BIGINT NOT NULL
);

CREATE UNIQUE INDEX teacher_newsletter_items_course_period_uniqueness ON teacher_newsletter_items (course_id, period_start, period_end, deleted_at) NULLS NOT DISTINCT;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON teacher_newsletter_items FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE teacher_newsletter_items IS 'Stores individual newsletter content items for a specific course within a defined date range. Multiple items are aggregated to generate a complete teacher newsletter, stored in both HTML and plain text formats.';
COMMENT ON COLUMN teacher_newsletter_items.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN teacher_newsletter_items.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN teacher_newsletter_items.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN teacher_newsletter_items.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN teacher_newsletter_items.course_id IS 'The course whose information the newsletter item holds.';
COMMENT ON COLUMN teacher_newsletter_items.period_start IS 'Start date of the period that the newsletter item content represents.';
COMMENT ON COLUMN teacher_newsletter_items.period_end IS 'End date of the period that the newsletter item content represents.';
COMMENT ON COLUMN teacher_newsletter_items.returned_exercises_count IS '';
COMMENT ON COLUMN teacher_newsletter_items.completed_course_count IS '';
COMMENT ON COLUMN teacher_newsletter_items.started_course_count IS '';
COMMENT ON COLUMN teacher_newsletter_items.flagged_cheaters_count_period IS '';
COMMENT ON COLUMN teacher_newsletter_items.flagged_cheaters_count_total IS '';
COMMENT ON COLUMN teacher_newsletter_items.unread_feedback_count_period IS '';
COMMENT ON COLUMN teacher_newsletter_items.unread_feedback_count_total IS '';
COMMENT ON COLUMN teacher_newsletter_items.proposal_count_period IS '';
COMMENT ON COLUMN teacher_newsletter_items.proposal_count_total IS '';

CREATE TABLE teacher_newsletter_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscribed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX teacher_newsletter_subscriptions_user_uniqueness ON teacher_newsletter_subscriptions (user_id, deleted_at) NULLS NOT DISTINCT;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON teacher_newsletter_subscriptions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE teacher_newsletter_subscriptions IS 'Tracks user subscription statuses for the teacher newsletter.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.user_id IS 'The user whose subscription status is tracked.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.subscribed IS 'True if subscribed to the newsletter, false otherwise.';

CREATE TABLE teacher_newsletter_delivery (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW (),
  deleted_at TIMESTAMP WITH TIME ZONE,
  delivery_id UUID NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

COMMENT ON TABLE teacher_newsletter_delivery IS '';
COMMENT ON COLUMN teacher_newsletter_delivery.id IS 'A unique, stable identified for the record.';
COMMENT ON COLUMN teacher_newsletter_delivery.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN teacher_newsletter_delivery.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN teacher_newsletter_delivery.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN teacher_newsletter_delivery.delivery_id IS 'A unique, stable identified for the record.';
COMMENT ON COLUMN teacher_newsletter_delivery.period_start IS 'Start date of the period that the newsletter represents.';
COMMENT ON COLUMN teacher_newsletter_delivery.period_end IS 'End date of the period that the newsletter represents.';

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON teacher_newsletter_delivery FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TYPE email_template_type
ADD VALUE 'teacher_newsletter';
