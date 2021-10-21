-- Add down migration script here
ALTER TABLE course_instances DROP support_email,
  DROP teacher_in_charge_name,
  DROP teacher_in_charge_email;
