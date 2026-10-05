COMMENT ON TABLE study_registry_student_number_conflicts IS 'Student numbers a registrar reported for an account that could not become its study_registry link because a live link already stood in the way. The existing link is kept; a row stops mattering once the account holds the reported number.';

ALTER TABLE credit_registrations
ADD COLUMN attainment_date DATE;

ALTER TABLE credit_registrations DISABLE TRIGGER set_timestamp;
UPDATE credit_registrations
SET attainment_date = (attained_at AT TIME ZONE 'Europe/Helsinki')::date
WHERE attained_at IS NOT NULL;
ALTER TABLE credit_registrations ENABLE TRIGGER set_timestamp;

ALTER TABLE credit_registrations DROP COLUMN attained_at;

COMMENT ON COLUMN credit_registrations.attainment_date IS 'Frozen attainment date submitted.';
