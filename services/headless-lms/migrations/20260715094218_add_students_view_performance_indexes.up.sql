-- Indexes for the course "Students" management view; its queries filtered these tables on unindexed
-- columns. Partial (deleted_at IS NULL) matches the queries' predicates and keeps the indexes small.
-- In production, build each CONCURRENTLY first; the IF NOT EXISTS clauses then make this a no-op.

-- Identity list + count filter enrollments by course_id (never user_id); existing indexes lead with
-- user_id. Hottest path in the view.
CREATE INDEX IF NOT EXISTS course_instance_enrollments_course_id_user_id_idx ON course_instance_enrollments (course_id, user_id)
WHERE deleted_at IS NULL;

-- Certificates tab fetches certificates for a page of users (user_id = ANY(...)); table had only a PK
-- and a verification_id unique index.
CREATE INDEX IF NOT EXISTS generated_certificates_user_id_idx ON generated_certificates (user_id)
WHERE deleted_at IS NULL;

-- Completions tab filters this table by course_id to resolve study-registry registration; PK only.
CREATE INDEX IF NOT EXISTS cmc_registered_to_study_registries_course_id_idx ON course_module_completion_registered_to_study_registries (course_id)
WHERE deleted_at IS NULL;
