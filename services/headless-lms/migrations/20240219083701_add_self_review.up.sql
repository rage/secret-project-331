ALTER TABLE exercises
ADD COLUMN needs_self_review BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exercises.needs_self_review IS 'If true, students are required to review their own submissions before getting any points.';
ALTER TABLE peer_review_configs
ADD COLUMN review_instructions JSONB;
COMMENT ON COLUMN peer_review_configs.review_instructions IS 'Content of additional instructions shown when self of peer review starts. The content is in an abstract format, the same as pages.content.';
