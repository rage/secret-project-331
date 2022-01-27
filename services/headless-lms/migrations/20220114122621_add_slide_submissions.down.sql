-- Restore columns and content to exercise_task_submissions
ALTER TABLE exercise_task_submissions
ADD COLUMN course_id UUID REFERENCES courses,
  ADD COLUMN course_instance_id UUID REFERENCES course_instances,
  ADD COLUMN exam_id UUID REFERENCES exams,
  ADD COLUMN exercise_id UUID REFERENCES exercises,
  ADD COLUMN user_id UUID REFERENCES users;
COMMENT ON COLUMN exercise_task_submissions.course_id IS 'Which course this submission belongs to. The field is here for making certain SQL queries easier, the same information is available from submission.exercise_task.exercise.course_id.';
COMMENT ON COLUMN exercise_task_submissions.course_instance_id IS 'Which course instance this submission was returned to. We need this field because each course instance has different submission lists. A submission to one course instance should not influence other submissions made later on to other course instance. This is useful, for example, if we have a course that never changes but it has a yearly run with a course variant for each year. Associating the submission with the course instance allows students to take the course even if they have tried a previous variant.';
COMMENT ON COLUMN exercise_task_submissions.exam_id IS 'The exam the submission is associated with.';
COMMENT ON COLUMN exercise_task_submissions.exercise_id IS 'Which exercise this submission belongs to.';
COMMENT ON COLUMN exercise_task_submissions.user_id IS 'The user that returned the submission';
UPDATE exercise_task_submissions ets
SET course_id = ess.course_id,
  course_instance_id = ess.course_instance_id,
  exam_id = ess.exam_id,
  exercise_id = ess.exercise_id,
  user_id = ess.user_id
FROM exercise_slide_submissions ess
WHERE ets.exercise_slide_submission_id = ets.id;
ALTER TABLE exercise_task_submissions
ALTER COLUMN exercise_id
SET NOT NULL,
  ALTER COLUMN user_id
SET NOT NULL,
  DROP COLUMN exercise_slide_submission_id,
  ADD CONSTRAINT course_instance_or_exam_id_set CHECK (
    (course_instance_id IS NULL) <> (exam_id IS NULL)
  );
DROP TABLE exercise_slide_submissions;
ALTER TABLE exercise_task_submissions
  RENAME TO submissions;
