COMMENT ON TABLE exercise_task_submission_files IS 'Links a task submission to the files the client uploaded for it, so the host can serve a submission''s files back without interpreting the exercise service''s answer.';

ALTER TABLE rejected_exercise_task_submissions
  DROP COLUMN answer_kind;

ALTER TABLE exercise_task_submissions
  DROP CONSTRAINT exercise_task_submissions_json_answer_has_data;
ALTER TABLE exercise_task_submissions
  DROP COLUMN answer_kind;

DROP TYPE answer_kind;
