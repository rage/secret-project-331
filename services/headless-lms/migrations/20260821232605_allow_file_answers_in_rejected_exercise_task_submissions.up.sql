ALTER TABLE rejected_exercise_task_submissions
ALTER COLUMN data_json DROP NOT NULL;

-- NOT VALID: data_json was NOT NULL until the statement above, so every existing row conforms.
-- Inserts and updates are still checked.
ALTER TABLE rejected_exercise_task_submissions
ADD CONSTRAINT rejected_exercise_task_submissions_json_answer_has_data
CHECK (answer_kind <> 'json' OR data_json IS NOT NULL) NOT VALID;
