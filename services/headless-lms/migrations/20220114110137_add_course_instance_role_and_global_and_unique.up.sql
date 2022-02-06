-- Add up migration script here
ALTER TABLE roles
ADD course_instance_id UUID REFERENCES course_instances,
  ADD is_global BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT single_role_for_domain CHECK (
    (
      num_nonnulls(
        organization_id,
        course_id,
        course_instance_id,
        exam_id
      ) = 1
      AND is_global = FALSE
    )
    OR (
      num_nonnulls(
        organization_id,
        course_id,
        course_instance_id,
        exam_id
      ) = 0
      AND is_global = TRUE
    )
  );
