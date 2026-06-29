CREATE TYPE course_ai_policy AS ENUM (
  'not_set',
  'no_ai',
  'planning_only',
  'limited',
  'full_use',
  'required'
);
ALTER TABLE courses
ADD COLUMN ai_policy course_ai_policy NOT NULL DEFAULT 'not_set',
  ADD COLUMN course_material_ai_instructions BOOLEAN;
COMMENT ON COLUMN courses.ai_policy IS 'Teacher-selected AI policy that adapts the student AI usage notice; not_set shows the generic default message.';
COMMENT ON COLUMN courses.course_material_ai_instructions IS 'Whether the course material contains AI instructions: NULL = unknown, true = yes, false = no. Tweaks the notice wording and whether the university-guidelines link is shown.';
