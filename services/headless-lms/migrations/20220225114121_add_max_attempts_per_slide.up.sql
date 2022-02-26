ALTER TABLE exercises
ADD COLUMN max_attempts_per_slide INTEGER DEFAULT NULL;
COMMENT ON COLUMN exercises.max_attempts_per_slide IS 'The maximum number of attempts the user is allowed submit the exercise for each slide. Enforced only if  limit_number_of_attempts is true. If limit_number_of_attempts is false, this column just stores what the teacher has previously typed in the exercise editor.';
ALTER TABLE exercises
ADD COLUMN limit_number_of_attempts BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exercises.limit_number_of_attempts IS 'Whether the number of attempts the user is allowed to submit an exercise slide is limited. If true, the actual limit is defined by max_attempts_per_slide. If null, the limit is unlimited.';
