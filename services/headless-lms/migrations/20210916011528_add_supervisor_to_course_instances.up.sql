-- Add up migration script here
ALTER TABLE course_instances
ADD COLUMN support_email VARCHAR(255) CHECK (support_email LIKE '%@%'),
  ADD COLUMN teacher_in_charge_name VARCHAR(255) NOT NULL,
  ADD COLUMN teacher_in_charge_email VARCHAR(255) NOT NULL CHECK (teacher_in_charge_email LIKE '%@%'),
  ADD CHECK (TRIM(teacher_in_charge_name) <> ''),
  ADD CHECK (TRIM(teacher_in_charge_email) <> '');
