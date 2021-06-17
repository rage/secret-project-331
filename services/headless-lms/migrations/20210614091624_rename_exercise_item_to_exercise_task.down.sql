-- Add down migration script here
COMMENT ON TABLE exercises IS 'Exercise is an collection of exercise items. The exercise itself does not contain any information on what kind of activities it contains -- that information lives inside the items. This enables us for example to combine different exercise types or to provide different assignments to different students.';
ALTER TABLE exercise_tasks
  RENAME TO exercise_items;
ALTER TABLE submissions
  RENAME COLUMN exercise_task_id TO exercise_item_id;
ALTER TABLE gradings
  RENAME COLUMN exercise_task_id TO exercise_item_id;
