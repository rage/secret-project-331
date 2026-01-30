ALTER TABLE peer_or_self_review_configs
ADD COLUMN reset_answer_if_zero_points_from_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN peer_or_self_review_configs.reset_answer_if_zero_points_from_review IS 'If true, the users answer will be automatically reset when peer/self review final score is zero.';
