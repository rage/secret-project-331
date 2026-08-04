-- Requirements pointing at a deleted configuration break course copying.
UPDATE certificate_configuration_to_requirements cctr
SET deleted_at = now()
FROM certificate_configurations cc
WHERE cctr.certificate_configuration_id = cc.id
  AND cctr.deleted_at IS NULL
  AND cc.deleted_at IS NOT NULL;
