ALTER TYPE reviewing_stage RENAME VALUE 'not_started' TO 'not_answered';
ALTER TYPE reviewing_stage RENAME VALUE 'reviewed_and_locked' TO 'complete';
ALTER TYPE reviewing_stage RENAME TO exercise_progress;

ALTER TABLE user_exercise_states RENAME COLUMN reviewing_stage TO exercise_progress;
