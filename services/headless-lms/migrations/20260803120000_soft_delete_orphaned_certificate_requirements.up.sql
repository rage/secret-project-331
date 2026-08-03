-- Deleting a certificate configuration used to leave its requirement rows live. Course copying
-- copies only live configurations, so those orphans made the copy fail on the foreign key.
UPDATE certificate_configuration_to_requirements cctr
SET deleted_at = now()
FROM certificate_configurations cc
WHERE cctr.certificate_configuration_id = cc.id
  AND cctr.deleted_at IS NULL
  AND cc.deleted_at IS NOT NULL;
