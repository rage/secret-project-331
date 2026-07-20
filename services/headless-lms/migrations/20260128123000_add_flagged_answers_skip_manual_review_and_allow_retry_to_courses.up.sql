ALTER TABLE courses
ADD COLUMN flagged_answers_skip_manual_review_and_allow_retry boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN courses.flagged_answers_skip_manual_review_and_allow_retry IS 'If true, automatically reset answers when they are flagged too many times.';
