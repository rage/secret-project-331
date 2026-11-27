DROP TABLE course_designer_plan_section_statuses;
DROP TYPE course_designer_section_status;

CREATE TYPE course_designer_automatic_check AS ENUM (
  'content_filled',
  'exercises_exist',
  'course_published'
);

COMMENT ON TYPE course_designer_automatic_check IS 'A check of the course created from a course design plan that decides whether an automatic task is done.';

ALTER TABLE course_designer_plan_stage_tasks
ADD COLUMN automatic_check course_designer_automatic_check;

COMMENT ON COLUMN course_designer_plan_stage_tasks.automatic_check IS 'Set on automatic tasks, NULL on manual ones. An automatic task is done when its check passes on the plan''s course, computed whenever the plan is read; its is_completed stays false and cannot be set.';

ALTER TYPE application_task
ADD VALUE IF NOT EXISTS 'course-plan-drafting';
