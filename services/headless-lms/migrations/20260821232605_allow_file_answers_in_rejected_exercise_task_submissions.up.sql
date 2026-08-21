ALTER TABLE rejected_exercise_task_submissions
ALTER COLUMN data_json DROP NOT NULL;

ALTER TABLE rejected_exercise_task_submissions
ADD CONSTRAINT rejected_exercise_task_submissions_json_answer_has_data
CHECK (answer_kind <> 'json' OR data_json IS NOT NULL);
