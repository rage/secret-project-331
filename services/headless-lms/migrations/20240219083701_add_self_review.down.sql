-- Undo renaming columns
ALTER TABLE peer_or_self_review_question_submissions
  RENAME COLUMN peer_or_self_review_submission_id TO peer_review_submission_id;
ALTER TABLE peer_or_self_review_question_submissions
  RENAME COLUMN peer_or_self_review_question_id TO peer_review_question_id;
ALTER TABLE peer_or_self_review_questions
  RENAME COLUMN peer_or_self_review_config_id TO peer_review_config_id;
ALTER TABLE exercises
  RENAME COLUMN use_course_default_peer_or_self_review_config TO use_course_default_peer_review_config;
ALTER TABLE peer_or_self_review_submissions
  RENAME COLUMN peer_or_self_review_config_id TO peer_review_config_id;
-- Undo renaming tables
ALTER TABLE peer_or_self_review_questions
  RENAME TO peer_review_questions;
ALTER TABLE peer_or_self_review_submissions
  RENAME TO peer_review_submissions;
ALTER TABLE peer_or_self_review_question_submissions
  RENAME TO peer_review_question_submissions;
ALTER TABLE peer_or_self_review_configs
  RENAME TO peer_review_configs;
-- Drop added columns
ALTER TABLE peer_review_configs DROP COLUMN review_instructions;
ALTER TABLE exercises DROP COLUMN needs_self_review;
