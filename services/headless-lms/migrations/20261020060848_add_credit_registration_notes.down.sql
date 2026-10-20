DELETE FROM credit_registration_admin_actions
WHERE action = 'add_note';

ALTER TYPE credit_registration_admin_action
RENAME TO credit_registration_admin_action_new;
CREATE TYPE credit_registration_admin_action AS ENUM (
  'retry_item',
  'retry_failed_for_course',
  'force_recheck',
  'mark_resolved',
  'requeue_batch',
  'transition_item',
  'cancel_registration',
  'pause_course_module',
  'resume_course_module',
  'pause_phase',
  'resume_phase',
  'run_phase_now',
  'resend_link_email',
  'unlink_student_number',
  'manual_link_student_number',
  'override_rate_cap',
  'request_enrolment_list_fetch',
  'dismiss_study_registry_conflict',
  'dismiss_attention'
);
COMMENT ON TYPE credit_registration_admin_action IS 'Manual actions a global admin or a course teacher can take on the credit registration pipeline. There is deliberately no per-item pause: the per-module pause plus needs_admin_attention cover that case.';
ALTER TABLE credit_registration_admin_actions
ALTER COLUMN action TYPE credit_registration_admin_action USING action::text::credit_registration_admin_action;
DROP TYPE credit_registration_admin_action_new;
