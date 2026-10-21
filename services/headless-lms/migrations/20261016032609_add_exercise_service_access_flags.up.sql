ALTER TABLE exercise_services
ADD COLUMN is_global_admin_only BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_experimental BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN exercise_services.is_global_admin_only IS 'If true, only global admins can add new tasks of this type to pages. Teachers can still edit existing tasks of this type.';
COMMENT ON COLUMN exercise_services.is_experimental IS 'If true, teachers are shown that this exercise type is experimental. Informational only; does not change behaviour and is not shown to students.';
