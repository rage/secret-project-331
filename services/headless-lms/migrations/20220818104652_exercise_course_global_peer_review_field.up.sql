-- Add up migration script here
ALTER TABLE exercises
ADD COLUMN use_course_default_peer_review_config boolean NOT NULL DEFAULT TRUE;
ALTER TABLE peer_reviews
  RENAME TO peer_review_configs;
ALTER TABLE peer_review_questions
  RENAME COLUMN peer_review_id TO peer_review_config_id;
ALTER TABLE peer_review_submissions
  RENAME COLUMN peer_review_id TO peer_review_config_id;
COMMENT ON COLUMN exercises.use_course_default_peer_review_config IS 'Shows if exercise uses course''s default peer review config. Default peer review config is needed to exists for this to work. Default peer review config is shared among all course''s exercises that has this set to true';
COMMENT ON TABLE peer_review_configs IS 'Collection of settings and peer review questions that users have to answer to evaluate each others'' answers.';
