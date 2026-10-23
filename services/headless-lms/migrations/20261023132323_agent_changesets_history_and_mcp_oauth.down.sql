ALTER TABLE oauth_auth_codes DROP COLUMN resource;

ALTER TABLE oauth_user_client_scopes DROP CONSTRAINT oauth_user_client_scopes_id_key,
  DROP COLUMN last_used_at,
  DROP COLUMN id;

ALTER TABLE oauth_clients DROP CONSTRAINT oauth_clients_metadata_document_client_id_is_https_url,
  DROP COLUMN logo_uri,
  DROP COLUMN client_uri,
  DROP COLUMN metadata_document_fetched_at;

DROP INDEX idx_page_history_changeset;
ALTER TABLE page_history DROP CONSTRAINT page_history_agent_fields_together,
  DROP COLUMN agent_changeset_id,
  DROP COLUMN agent_client_name;

DROP TABLE course_settings_history;
DROP TABLE course_module_history;
DROP TABLE chapter_history;
DROP TABLE agent_changeset_calls;
DROP TABLE agent_changeset_entities;
DROP TABLE agent_changesets;

DROP TYPE entity_history_change_reason;
DROP TYPE agent_changeset_entity_operation;
DROP TYPE agent_changeset_entity_type;
DROP TYPE agent_changeset_status;
