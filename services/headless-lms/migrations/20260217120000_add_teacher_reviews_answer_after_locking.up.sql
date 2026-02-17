ALTER TABLE exercises
ADD COLUMN teacher_reviews_answer_after_locking BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN exercises.teacher_reviews_answer_after_locking IS
'When true (default), answers go to manual review when chapter is locked.
When false, exercises with automated grading receive points immediately and lock without teacher review.';
