-- Add up migration script here
COMMENT ON TABLE exercises IS 'Exercise is an collection of exercise tasks. The exercise itself does not contain any information on what kind of activities it contains -- that information lives inside the tasks. This enables us for example to combine different exercise types or to provide different assignments to different students.';
ALTER TABLE exercise_items
  RENAME TO exercise_tasks;
ALTER TABLE submissions
  RENAME COLUMN exercise_item_id TO exercise_task_id;
ALTER TABLE gradings
  RENAME COLUMN exercise_item_id TO exercise_task_id;
