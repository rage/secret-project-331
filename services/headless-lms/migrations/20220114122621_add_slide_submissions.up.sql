-- Rename existing submissions table to exercise_task_submissions
ALTER TABLE submissions
  RENAME TO exercise_task_submissions;
-- Add new table for exercise slide submissions
CREATE TABLE exercise_slide_submissions(
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID REFERENCES courses,
  course_instance_id UUID REFERENCES course_instances,
  exam_id UUID REFERENCES exams,
  exercise_id UUID NOT NULL REFERENCES exercises,
  user_id UUID NOT NULL REFERENCES users,
  temp_task_submission_id UUID REFERENCES exercise_task_submissions
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_slide_submissions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE exercise_slide_submissions IS 'Table that groups together all individual task submissions for an excercise.';
COMMENT ON COLUMN exercise_slide_submissions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_slide_submissions.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN exercise_slide_submissions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_slide_submissions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_slide_submissions.course_id IS 'Which course this submission belongs to. The field is here for making certain SQL queries easier, the same information is available from exercise_slide_submission.exercise_task.exercise.course_id.';
COMMENT ON COLUMN exercise_slide_submissions.course_instance_id IS 'Which course instance this submission was returned to. We need this field because each course instance has different submission lists. A submission to one course instance should not influence other submissions made later on to other course instance. This is useful, for example, if we have a course that never changes but it has a yearly run with a course variant for each year. Associating the submission with the course instance allows students to take the course even if they have tried a previous variant.';
COMMENT ON COLUMN exercise_slide_submissions.exam_id IS 'The exam the submission is associated with.';
COMMENT ON COLUMN exercise_slide_submissions.exercise_id IS 'Which exercise this submission belongs to.';
COMMENT ON COLUMN exercise_slide_submissions.user_id IS 'The user that returned the submission';
ALTER TABLE exercise_slide_submissions
ADD CONSTRAINT course_instance_or_exam_id_set CHECK (
    (course_instance_id IS NULL) <> (exam_id IS NULL)
  );
ALTER TABLE exercise_task_submissions DROP CONSTRAINT course_instance_or_exam_id_set;
-- Assume only one task submissions per slide so far
INSERT INTO exercise_slide_submissions (
    deleted_at,
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id,
    temp_task_submission_id
  )
SELECT deleted_at,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id,
  id
FROM exercise_task_submissions;
-- Update exercise_task_submissions to refer to newly created slide_submissions
ALTER TABLE exercise_task_submissions
ADD COLUMN exercise_slide_submission_id UUID REFERENCES exercise_slide_submissions;
COMMENT ON COLUMN exercise_task_submissions.exercise_slide_submission_id IS 'exercise_slide_submission that this task submission is a part of.';
UPDATE exercise_task_submissions ets
SET exercise_slide_submission_id = ess.id
FROM exercise_slide_submissions ess
WHERE ess.temp_task_submission_id = ets.id;
ALTER TABLE exercise_task_submissions
ALTER COLUMN exercise_slide_submission_id
SET NOT NULL;
-- Remove migrated fields
ALTER TABLE exercise_slide_submissions DROP COLUMN temp_task_submission_id;
ALTER TABLE exercise_task_submissions DROP COLUMN course_id,
  DROP COLUMN course_instance_id,
  DROP COLUMN exam_id,
  DROP COLUMN exercise_id,
  DROP COLUMN user_id;
