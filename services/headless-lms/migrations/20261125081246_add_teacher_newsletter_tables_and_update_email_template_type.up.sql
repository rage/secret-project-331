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

COMMENT ON TABLE teacher_newsletter_items IS 'A teacher newsletter item contains stats calculated for a course for a defined period alongside total counts for some stats. A complete teacher newsletter is made up of individual teacher newsletter items.';
COMMENT ON COLUMN teacher_newsletter_items.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN teacher_newsletter_items.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN teacher_newsletter_items.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN teacher_newsletter_items.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN teacher_newsletter_items.course_id IS 'The course whose information the newsletter item holds.';
COMMENT ON COLUMN teacher_newsletter_items.period_start IS 'Start date of the period covered by the newsletter item.';
COMMENT ON COLUMN teacher_newsletter_items.period_end IS 'End date of the period covered by the newsletter item.';
COMMENT ON COLUMN teacher_newsletter_items.returned_exercises_count IS 'Count of unique users who returned at least one exercise in the defined period.';
COMMENT ON COLUMN teacher_newsletter_items.completed_course_count IS 'Count of unique users who completed the course in the defined period.';
COMMENT ON COLUMN teacher_newsletter_items.started_course_count IS 'Count of unique users who started the course in the defined period.';
COMMENT ON COLUMN teacher_newsletter_items.flagged_cheaters_count_period IS 'Count of suspected cheaters in a flagged review state in the defined period.';
COMMENT ON COLUMN teacher_newsletter_items.flagged_cheaters_count_total IS 'Total count of the suspected cheaters in a flagged review state.';
COMMENT ON COLUMN teacher_newsletter_items.unread_feedback_count_period IS 'Count of unread feedback in the defined period';
COMMENT ON COLUMN teacher_newsletter_items.unread_feedback_count_total IS 'Total count of unread feedback.';
COMMENT ON COLUMN teacher_newsletter_items.proposal_count_period IS 'Count of proposed changes to course material in the defined period.';
COMMENT ON COLUMN teacher_newsletter_items.proposal_count_total IS 'Total count of proposed changes to course material.';

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

COMMENT ON TABLE teacher_newsletter_subscriptions IS 'User subscription statuses for the teacher newsletter.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.user_id IS 'The user whose subscription status is tracked.';
COMMENT ON COLUMN teacher_newsletter_subscriptions.subscribed IS 'True if subscribed to the newsletter, false otherwise.';

CREATE TABLE teacher_newsletter_delivery_periods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW (),
  deleted_at TIMESTAMP WITH TIME ZONE,
  email_delivery_id UUID NOT NULL REFERENCES email_deliveries (id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

COMMENT ON TABLE teacher_newsletter_delivery_periods IS 'For looking up the date period covered by a teacher newsletter via its email delivery ID when sending the email.';
COMMENT ON COLUMN teacher_newsletter_delivery_periods.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN teacher_newsletter_delivery_periods.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN teacher_newsletter_delivery_periods.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN teacher_newsletter_delivery_periods.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN teacher_newsletter_delivery_periods.email_delivery_id IS 'Foreign key to the parent email_deliveries row this error belongs to.';
COMMENT ON COLUMN teacher_newsletter_delivery_periods.period_start IS 'Start date of the period covered by the newsletter.';
COMMENT ON COLUMN teacher_newsletter_delivery_periods.period_end IS 'End date of the period covered by the newsletter.';

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON teacher_newsletter_delivery_periods FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

ALTER TYPE email_template_type
ADD VALUE 'teacher_newsletter';
