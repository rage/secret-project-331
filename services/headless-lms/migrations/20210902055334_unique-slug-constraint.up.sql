-- Add up migration script here
ALTER TABLE exercise_services DROP CONSTRAINT exercise_services_slug_key;
CREATE UNIQUE INDEX exercise_services_unique_slug ON public.exercise_services USING btree (slug)
WHERE deleted_at IS NULL;
