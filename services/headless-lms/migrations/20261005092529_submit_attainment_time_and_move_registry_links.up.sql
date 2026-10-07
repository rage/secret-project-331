COMMENT ON TABLE study_registry_student_number_conflicts IS 'Student numbers a registrar reported for an account that could not become its study_registry link because a live link already stood in the way: the account''s own link, or a link someone made by hand on that number. Another account''s study_registry link does not block; it moves to the reported account. A row stops mattering once the account holds the reported number.';

ALTER TABLE credit_registrations
ADD COLUMN attained_at TIMESTAMP WITH TIME ZONE;

-- Keeps updated_at, which would otherwise mark every frozen row as just changed.
ALTER TABLE credit_registrations DISABLE TRIGGER set_timestamp;
-- A completion moved to another day since its payload froze keeps the frozen date, at midnight.
UPDATE credit_registrations cr
SET attained_at = CASE
    WHEN (cmc.completion_date AT TIME ZONE 'Europe/Helsinki')::date = cr.attainment_date THEN cmc.completion_date
    ELSE cr.attainment_date::timestamp AT TIME ZONE 'Europe/Helsinki'
  END
FROM course_module_completions cmc
WHERE cmc.id = cr.course_module_completion_id
  AND cr.attainment_date IS NOT NULL;
ALTER TABLE credit_registrations ENABLE TRIGGER set_timestamp;

ALTER TABLE credit_registrations DROP COLUMN attainment_date;

COMMENT ON COLUMN credit_registrations.attained_at IS 'Frozen attainment time submitted. Its date in Helsinki is the attainment date Sisu records.';
