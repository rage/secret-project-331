ALTER TABLE exercises
ADD COLUMN needs_self_review BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exercises.needs_self_review IS 'If true, students are required to review their own submissions before getting any points.';
ALTER TABLE peer_review_configs
ADD COLUMN review_instructions JSONB;
COMMENT ON COLUMN peer_review_configs.review_instructions IS 'Content of additional instructions shown when self of peer review starts. The content is in an abstract format, the same as pages.content.';
ALTER TABLE peer_review_configs
  RENAME TO peer_or_self_review_configs;
ALTER TABLE peer_review_question_submissions
  RENAME TO peer_or_self_review_question_submissions;
ALTER TABLE peer_review_submissions
  RENAME TO peer_or_self_review_submissions;
ALTER TABLE peer_review_questions
  RENAME TO peer_or_self_review_questions;
ALTER TABLE exercises
  RENAME COLUMN use_course_default_peer_review_config TO use_course_default_peer_or_self_review_config;
ALTER TABLE peer_or_self_review_questions
  RENAME COLUMN peer_review_config_id TO peer_or_self_review_config_id;
ALTER TABLE peer_or_self_review_question_submissions
  RENAME COLUMN peer_review_question_id TO peer_or_self_review_question_id;
ALTER TABLE peer_or_self_review_submissions
  RENAME COLUMN peer_review_config_id TO peer_or_self_review_config_id;
ALTER TABLE peer_or_self_review_question_submissions
  RENAME COLUMN peer_review_submission_id TO peer_or_self_review_submission_id;
