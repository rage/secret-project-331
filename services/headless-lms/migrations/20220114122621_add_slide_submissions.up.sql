-- Rename existing submissions table to exercise_task_submissions
ALTER TABLE submissions
  RENAME TO exercise_task_submissions;
-- Add exercise_slide_id to all task submissions
ALTER TABLE exercise_task_submissions
ADD COLUMN exercise_slide_id UUID REFERENCES exercise_slides;
UPDATE exercise_task_submissions ets
SET exercise_slide_id = et.exercise_slide_id
FROM exercise_tasks et
WHERE et.id = ets.exercise_task_id;
ALTER TABLE exercise_task_submissions
ALTER COLUMN exercise_slide_id
SET NOT NULL;
COMMENT ON COLUMN exercise_task_submissions.exercise_slide_id IS 'The exercise slide where this task submissions belongs to. Used to make sure that both the task and slide submissions belongs to the same slide.';
-- Add new table for exercise slide submissions
CREATE TABLE exercise_slide_submissions(
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_slide_id UUID NOT NULL REFERENCES exercise_slides,
  course_id UUID REFERENCES courses,
  course_instance_id UUID REFERENCES course_instances,
  exam_id UUID REFERENCES exams,
  exercise_id UUID NOT NULL REFERENCES exercises,
  user_id UUID NOT NULL REFERENCES users
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_slide_submissions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE exercise_slide_submissions IS 'Table that groups together all individual task submissions for a single exercise slise submission.';
COMMENT ON COLUMN exercise_slide_submissions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_slide_submissions.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN exercise_slide_submissions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_slide_submissions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_slide_submissions.exercise_slide_id IS 'Which exercise slide this submission belongs to.';
COMMENT ON COLUMN exercise_slide_submissions.course_id IS 'Which course this submission belongs to. The field is here for making certain SQL queries easier, the same information is available from exercise_slide_submission.exercise_task.exercise.course_id.';
COMMENT ON COLUMN exercise_slide_submissions.course_instance_id IS 'Which course instance this submission was returned to. We need this field because each course instance has different submission lists. A submission to one course instance should not influence other submissions made later on to other course instance. This is useful, for example, if we have a course that never changes but it has a yearly run with a course variant for each year. Associating the submission with the course instance allows students to take the course even if they have tried a previous variant.';
COMMENT ON COLUMN exercise_slide_submissions.exam_id IS 'The exam the submission is associated with.';
COMMENT ON COLUMN exercise_slide_submissions.exercise_id IS 'Which exercise this submission belongs to.';
COMMENT ON COLUMN exercise_slide_submissions.user_id IS 'The user that returned the submission';
-- Move instance or exam constraint to newly created task submissions
ALTER TABLE exercise_slide_submissions
ADD CONSTRAINT course_instance_or_exam_id_set CHECK (
    (course_instance_id IS NULL) <> (exam_id IS NULL)
  );
ALTER TABLE exercise_task_submissions DROP CONSTRAINT course_instance_or_exam_id_set;
-- Create reference column and migrate data from task submissions to slide submissions.
ALTER TABLE exercise_task_submissions
ADD COLUMN exercise_slide_submission_id UUID DEFAULT uuid_generate_v4 () NOT NULL;
COMMENT ON COLUMN exercise_task_submissions.exercise_slide_submission_id IS 'exercise_slide_submission that this task submission is a part of.';
INSERT INTO exercise_slide_submissions (
    id,
    deleted_at,
    exercise_slide_id,
    course_id,
    course_instance_id,
    exam_id,
    exercise_id,
    user_id
  )
SELECT exercise_slide_submission_id,
  deleted_at,
  exercise_slide_id,
  course_id,
  course_instance_id,
  exam_id,
  exercise_id,
  user_id
FROM exercise_task_submissions;
ALTER TABLE exercise_task_submissions
ALTER COLUMN exercise_slide_submission_id DROP DEFAULT;
ALTER TABLE exercise_task_submissions
ADD CONSTRAINT exercise_task_submissions_exercise_slide_submission_id_fkey FOREIGN KEY (exercise_slide_submission_id) REFERENCES exercise_slide_submissions (id);
-- Remove migrated fields
ALTER TABLE exercise_task_submissions DROP COLUMN course_id,
  DROP COLUMN course_instance_id,
  DROP COLUMN exam_id,
  DROP COLUMN exercise_id,
  DROP COLUMN user_id;
-- Add constraints to make sure that task and slide submissions refer to the same exercise slide.
CREATE UNIQUE INDEX exercise_slide_and_submission_ids ON exercise_slide_submissions(id, exercise_slide_id);
CREATE UNIQUE INDEX exercise_task_and_slide_ids ON exercise_tasks(id, exercise_slide_id);
ALTER TABLE exercise_task_submissions
ADD CONSTRAINT exercise_slide_submission_fk FOREIGN KEY (exercise_slide_submission_id, exercise_slide_id) REFERENCES exercise_slide_submissions(id, exercise_slide_id),
  ADD CONSTRAINT exercise_task_fk FOREIGN KEY (exercise_task_id, exercise_slide_id) REFERENCES exercise_tasks(id, exercise_slide_id);
