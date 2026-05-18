ALTER TABLE course_designer_plan_stages
ADD COLUMN workspace_data JSONB;

COMMENT ON COLUMN course_designer_plan_stages.workspace_data IS 'Stage-specific workspace payload (e.g. Analysis form). Nullable until the user saves.';
