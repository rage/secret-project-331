ALTER TABLE credit_registration_events
ALTER COLUMN created_at
SET DEFAULT clock_timestamp(),
  DROP COLUMN suotar_endpoint,
  DROP COLUMN suotar_requested_at,
  DROP COLUMN suotar_answered_at,
  DROP COLUMN suotar_answer;
DROP TYPE suotar_answer;
COMMENT ON COLUMN credit_registration_events.created_at IS 'Timestamp when the record was created, taken from the wall clock rather than the transaction start, so events appended in one transaction stay orderable. This is what the timeline sorts on.';
DELETE FROM roles
WHERE role = 'credit_registration_admin';
DELETE FROM pending_roles
WHERE role = 'credit_registration_admin';
ALTER TYPE user_role
RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM(
  'admin',
  'assistant',
  'teacher',
  'reviewer',
  'course_or_exam_creator',
  'material_viewer',
  'teaching_and_learning_services',
  'stats_viewer'
);
ALTER TABLE roles
ALTER COLUMN role TYPE user_role USING role::text::user_role;
ALTER TABLE pending_roles
ALTER COLUMN role TYPE user_role USING role::text::user_role;
DROP TYPE user_role_old;
