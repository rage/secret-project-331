-- Add up migration script here
ALTER TABLE exercise_tasks
ADD COLUMN order_number INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exercise_tasks
ALTER COLUMN order_number DROP DEFAULT;
COMMENT ON TABLE exercise_tasks.order_number IS 'The order in which the exercise task should appear in a slide.';
CREATE UNIQUE INDEX exercise_tasks_order_number_uniqueness ON exercise_tasks (exercise_slide_id, order_number)
WHERE deleted_at IS NULL;
