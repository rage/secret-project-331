-- The row spends a resolve-enrolments round trip in this state rather than checking_enrolment, so
-- import's claim query (which reads checking_enrolment) cannot pick it up before its enrolment is
-- actually resolved and its payload frozen.
ALTER TYPE credit_registration_state
ADD VALUE 'resolving_enrolment' AFTER 'ready_to_submit';

ALTER TABLE course_module_completion_registered_to_study_registries
ALTER COLUMN study_registry_registrar_id DROP NOT NULL;

COMMENT ON COLUMN course_module_completion_registered_to_study_registries.study_registry_registrar_id IS 'Registrar that registered this course module completion. Null when this platform registered the attainment itself: that is not a third party with a key to this API, so it has no registrar row, and null is what tells the two kinds of row apart. The pull endpoints have to exclude null rows alongside the calling registrar''s own.';

-- The push path used to attribute its rows to a registrar row the previous migration seeded at a
-- fixed id: an API client nobody could authenticate as, whose only purpose was to be pointed at. A
-- null registrar says the same thing, so the table goes back to holding third parties only.
UPDATE course_module_completion_registered_to_study_registries
SET study_registry_registrar_id = NULL
WHERE study_registry_registrar_id IN (
    SELECT id
    FROM study_registry_registrars
    WHERE name = 'Suotar (push)'
  );

DELETE FROM study_registry_registrars
WHERE name = 'Suotar (push)';

-- Must stay ahead of the index below, which cannot be built while duplicates remain.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY course_module_completion_id,
      study_registry_registrar_id
      ORDER BY created_at ASC,
        id ASC
    ) AS rn
  FROM course_module_completion_registered_to_study_registries
  WHERE deleted_at IS NULL
)
UPDATE course_module_completion_registered_to_study_registries
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND id IN (
    SELECT id
    FROM ranked
    WHERE rn > 1
  );

-- Arbiter for both the push mirror's insert and the pull path's insert.
CREATE UNIQUE INDEX cmc_registered_to_study_registries_completion_registrar_idx ON course_module_completion_registered_to_study_registries (course_module_completion_id, study_registry_registrar_id) NULLS NOT DISTINCT
WHERE deleted_at IS NULL;

ALTER TABLE course_module_suotar_realisations
ADD COLUMN last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listing_error credit_registration_error_code,
  ADD COLUMN consecutive_listing_failures INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN course_module_suotar_realisations.last_listing_attempted_at IS 'When enrolment discovery last tried to list this realisation, whether or not the roster arrived. Orders the listing queue, so a realisation that keeps failing cannot starve the rest.';
COMMENT ON COLUMN course_module_suotar_realisations.last_listing_error IS 'Why the last listing attempt failed, null once one succeeds. What separates a failed listing from an empty course: the last_* counters keep describing the last roster that did arrive.';
COMMENT ON COLUMN course_module_suotar_realisations.consecutive_listing_failures IS 'Failed listing attempts since the last successful one.';

-- A product whose refresh has never succeeded has no row to write the failure to, so the reason is
-- lost and the product sits at the head of the refresh queue for ever. Nullable columns let the
-- failure be recorded before any token exists, the same way a realisation records a failed listing.
ALTER TABLE open_university_product_access_tokens
ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN document_state DROP NOT NULL,
  ALTER COLUMN last_refreshed_at DROP NOT NULL,
  ALTER COLUMN last_refreshed_at DROP DEFAULT;

COMMENT ON COLUMN open_university_product_access_tokens.access_token IS 'The token itself, null until a refresh succeeds. A secret: it must never reach a log line or a stored Suotar body sample.';
COMMENT ON COLUMN open_university_product_access_tokens.state IS 'Token state as Suotar reports it, null until a refresh succeeds.';
COMMENT ON COLUMN open_university_product_access_tokens.document_state IS 'Document state as Suotar reports it, null until a refresh succeeds.';
COMMENT ON COLUMN open_university_product_access_tokens.last_refreshed_at IS 'When the token was last successfully refreshed, null if none ever has. Ordered against last_refresh_failed_at so a product that keeps failing cannot starve the rest of the queue.';
