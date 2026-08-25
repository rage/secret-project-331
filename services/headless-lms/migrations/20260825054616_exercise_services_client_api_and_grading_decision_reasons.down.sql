UPDATE teacher_grading_decisions
SET teacher_decision = 'suspected-plagiarism'
WHERE teacher_decision = 'unauthorized-ai-use';

UPDATE teacher_grading_decisions
SET teacher_decision = 'zero-points'
WHERE teacher_decision IN ('bad-answer', 'other');

ALTER TYPE teacher_decision_type
RENAME TO teacher_decision_type_old;

CREATE TYPE teacher_decision_type AS ENUM (
  'full-points',
  'zero-points',
  'custom-points',
  'suspected-plagiarism',
  'reject-and-reset'
);

ALTER TABLE teacher_grading_decisions
ALTER COLUMN teacher_decision TYPE teacher_decision_type USING teacher_decision::text::teacher_decision_type;

DROP TYPE teacher_decision_type_old;

ALTER TABLE exercise_service_info DROP COLUMN answer_files_endpoint_path;

DROP TABLE exercise_service_client_uploads;

DROP TABLE exercise_task_submission_files;

ALTER TABLE exercise_service_info DROP COLUMN build_user_answer_endpoint_path;

DROP TABLE IF EXISTS oauth_device_codes;
DROP TYPE IF EXISTS device_code_status;

DROP TABLE IF EXISTS exercise_slide_submission_shares;
