-- Add up migration script here
CREATE TABLE exercise_slides (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_number INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_slides FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX exercise_slides_order_number_per_exercise ON exercise_slides(exercise_id, order_number)
WHERE deleted_at IS NULL;
COMMENT ON TABLE exercise_slides IS 'Ordered or randomly selected part of an exercise. A slide can contain multiple individual tasks that are shown to the student at once and submitted at the same time.';
COMMENT ON COLUMN exercise_slides.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_slides.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_slides.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_slides.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_slides.exercise_id IS 'The exercise that this slide belongs to.';
COMMENT ON COLUMN exercise_slides.order_number IS 'The order in which this slide appears in.';
-- Turn old style tasks into slides with single tasks.
INSERT INTO exercise_slides (exercise_id, order_number)
SELECT exercise_id,
  0
FROM exercise_tasks;
ALTER TABLE exercise_tasks
ADD COLUMN exercise_slide_id UUID REFERENCES exercise_slides(id);
COMMENT ON COLUMN exercise_tasks.exercise_slide_id IS 'Slide where this tasks appears in.';
UPDATE exercise_tasks t
SET exercise_slide_id = s.id
FROM exercise_slides s
WHERE t.exercise_id = s.exercise_id;
ALTER TABLE exercise_tasks
ALTER COLUMN exercise_slide_id
SET NOT NULL,
  DROP COLUMN exercise_id;
-- Change user_exercise_states to point to slides instead of tasks.
ALTER TABLE user_exercise_states
ADD COLUMN selected_exercise_slide_id UUID REFERENCES exercise_slides(id);
UPDATE user_exercise_states ues
SET selected_exercise_slide_id = (
    SELECT t.exercise_slide_id
    FROM exercise_tasks t
    WHERE t.id = ues.selected_exercise_task_id
  );
ALTER TABLE user_exercise_states DROP COLUMN selected_exercise_task_id;
