DELETE FROM roles
WHERE role = 'material_viewer';
ALTER TYPE user_role
RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM(
  'admin',
  'assistant',
  'teacher',
  'reviewer',
  'course_or_exam_creator'
);
ALTER TABLE roles
ALTER COLUMN role TYPE user_role USING role::text::user_role;
DROP TYPE user_role_old;
