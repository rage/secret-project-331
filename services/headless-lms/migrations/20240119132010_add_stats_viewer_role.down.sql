DELETE FROM roles
WHERE role = 'teaching_and_learning_services';
ALTER TYPE user_role
RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM(
  'admin',
  'assistant',
  'teacher',
  'reviewer',
  'course_or_exam_creator',
  'material_viewer',
  'teaching_and_learning_services'
);
ALTER TABLE roles
ALTER COLUMN role TYPE user_role USING role::text::user_role;
ALTER TABLE pending_roles
ALTER COLUMN role TYPE user_role USING role::text::user_role;
DROP TYPE user_role_old;
