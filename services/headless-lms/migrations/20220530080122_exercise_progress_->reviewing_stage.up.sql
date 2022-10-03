ALTER TYPE exercise_progress RENAME TO reviewing_stage;
ALTER TYPE reviewing_stage RENAME VALUE 'not_answered' TO 'not_started';
ALTER TYPE reviewing_stage RENAME VALUE 'complete' TO 'reviewed_and_locked';
ALTER TYPE reviewing_stage ADD VALUE 'waiting_for_peer_reviews' BEFORE 'reviewed_and_locked';
ALTER TYPE reviewing_stage ADD VALUE 'waiting_for_manual_grading' BEFORE 'reviewed_and_locked';

ALTER TABLE user_exercise_states RENAME COLUMN exercise_progress TO reviewing_stage;

COMMENT ON TYPE reviewing_stage IS 'Tells what stage of reviewing the user is currently in. Used for for peer review and self review.';
COMMENT ON COLUMN user_exercise_states.reviewing_stage IS 'Tells what stage of reviewing the user is currently in. Used for for peer review and self review. If the user has started or completed some kind of review, it is assumed that they no longer can answer the exercise. See https://rage.github.io/secret-project-331/headless_lms_models/user_exercise_states/enum.ReviewingStage.html for more info.';
