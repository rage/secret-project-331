ALTER TABLE courses
DROP COLUMN ai_policy,
  DROP COLUMN course_material_ai_instructions;
DROP TYPE course_ai_policy;
