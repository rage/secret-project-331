-- Indexes for the course "Students" management view. Its queries filter these tables by columns
-- that had no supporting index, forcing full table scans that do not scale in production.
-- Partial (deleted_at IS NULL) matches the predicates the queries always use and keeps the indexes
-- small. In production, create each of these with CONCURRENTLY before applying this migration so the
-- build does not take a write lock; the IF NOT EXISTS clauses then make this migration a no-op.

-- The identity list + its count filter enrollments by course_id (never user_id), but the only
-- existing indexes lead with user_id. This is the single hottest path in the view.
CREATE INDEX IF NOT EXISTS course_instance_enrollments_course_id_user_id_idx ON course_instance_enrollments (course_id, user_id)
WHERE deleted_at IS NULL;

-- The Certificates tab fetches certificates for a page of users (user_id = ANY(...)); the table had
-- only its primary key and a verification_id unique index.
CREATE INDEX IF NOT EXISTS generated_certificates_user_id_idx ON generated_certificates (user_id)
WHERE deleted_at IS NULL;

-- The Completions tab resolves which completions are registered to a study registry, filtering this
-- table by course_id; it had only a primary key.
CREATE INDEX IF NOT EXISTS cmc_registered_to_study_registries_course_id_idx ON course_module_completion_registered_to_study_registries (course_id)
WHERE deleted_at IS NULL;
