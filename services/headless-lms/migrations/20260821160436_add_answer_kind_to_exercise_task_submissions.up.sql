CREATE TYPE answer_kind AS ENUM ('json', 'file');

ALTER TABLE exercise_task_submissions
  ADD COLUMN answer_kind answer_kind NOT NULL DEFAULT 'json';
ALTER TABLE exercise_task_submissions
  ADD CONSTRAINT exercise_task_submissions_json_answer_has_data
  CHECK (answer_kind <> 'json' OR data_json IS NOT NULL);

ALTER TABLE rejected_exercise_task_submissions
  ADD COLUMN answer_kind answer_kind NOT NULL DEFAULT 'json';

COMMENT ON COLUMN exercise_task_submissions.answer_kind IS 'Whether the answer is the opaque blob in data_json, or the files in exercise_task_submission_files with data_json holding the exercise service''s metadata about them.';
COMMENT ON COLUMN rejected_exercise_task_submissions.answer_kind IS 'Mirrors exercise_task_submissions.answer_kind for the rejected copy of the answer.';
COMMENT ON TABLE exercise_task_submission_files IS 'The files a task submission was made from. When the submission''s answer_kind is ''file'', these rows are the answer itself; when ''json'', they merely accompany it.';
