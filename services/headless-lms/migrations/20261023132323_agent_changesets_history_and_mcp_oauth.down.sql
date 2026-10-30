DROP TABLE agent_changeset_preview_links;
CREATE OR REPLACE FUNCTION is_valid_oauth_uri(uri TEXT) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN IF uri IS NULL
  OR trim(uri) = ''
  OR uri ~ '\s'
  OR uri LIKE '%#%' THEN RETURN FALSE;
END IF;

  -- https (general)
IF uri ~* '^https://[^\s]+$' THEN RETURN TRUE;

  -- http on loopback for dev
ELSIF uri ~* '^http://((localhost(\.localdomain)?)|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?(?:/[^\s]*)?$' THEN RETURN TRUE;

  -- custom schemes (no "http"/"https" prefix)
ELSIF uri ~* '^(?!https?://)[A-Za-z][A-Za-z0-9+.\-]*:(//)?[^\s]+$' THEN RETURN TRUE;

  -- URNs
ELSIF uri ~* '^urn:[A-Za-z0-9][A-Za-z0-9\-]{0,31}:[^\s]+$' THEN RETURN TRUE;
END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION is_valid_oauth_uri(TEXT) IS 'Validates OAuth-safe redirect/identifier URIs: https, http loopback (dev), custom schemes, and URNs.';

-- Plain-http audiences, such as the MCP endpoint on dev hosts, fail the restored check.
DELETE FROM oauth_refresh_tokens
WHERE NOT are_valid_oauth_uris_or_null(audience);
DELETE FROM oauth_access_tokens
WHERE NOT are_valid_oauth_uris_or_null(audience);

ALTER TABLE oauth_refresh_tokens
ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience));
ALTER TABLE oauth_access_tokens
ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience));

ALTER TABLE oauth_auth_codes DROP COLUMN resource;

ALTER TABLE oauth_user_client_scopes DROP CONSTRAINT oauth_user_client_scopes_id_key,
  DROP COLUMN last_used_at,
  DROP COLUMN id;

ALTER TABLE oauth_clients DROP CONSTRAINT oauth_clients_metadata_document_client_id_is_https_url,
  DROP COLUMN client_uri,
  DROP COLUMN metadata_document_fetched_at;

ALTER TABLE chapters
ALTER CONSTRAINT chapters_front_page_id_fkey NOT DEFERRABLE;
ALTER TABLE material_references DROP CONSTRAINT citation_key_uniqueness,
  ADD CONSTRAINT citation_key_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, citation_key, deleted_at);
ALTER TABLE pages DROP CONSTRAINT unique_pages_url_path_course_id_when_not_deleted,
  ADD CONSTRAINT unique_pages_url_path_course_id_when_not_deleted UNIQUE NULLS NOT DISTINCT (url_path, exam_id, course_id, deleted_at),
  DROP CONSTRAINT pages_order_number_uniqueness,
  ADD CONSTRAINT pages_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    chapter_id,
    order_number,
    deleted_at
  );
ALTER TABLE course_modules DROP CONSTRAINT course_modules_order_number_uniqueness,
  ADD CONSTRAINT course_modules_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, order_number, deleted_at);
ALTER TABLE chapters DROP CONSTRAINT unique_chapters_chapter_number_course_id_when_not_deleted,
  ADD CONSTRAINT unique_chapters_chapter_number_course_id_when_not_deleted UNIQUE NULLS NOT DISTINCT (chapter_number, course_id, deleted_at);

DROP INDEX idx_proposed_block_edits_proposal;
DROP INDEX idx_proposed_page_edits_page;
DROP INDEX idx_block_feedback_feedback;
DROP INDEX idx_feedback_page;
DROP INDEX idx_course_module_completions_course_module;
ALTER TABLE page_history DROP COLUMN agent_call_id;

DROP TABLE entity_history;
DROP TABLE agent_changeset_call_entities;
DROP TABLE agent_changeset_calls;
DROP TABLE agent_changeset_entities;
DROP FUNCTION agent_changeset_current_status(agent_changeset_status, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION agent_changeset_is_open(agent_changeset_status, TIMESTAMP WITH TIME ZONE);
DROP TABLE agent_changesets;

DROP TYPE entity_history_change_reason;
DROP TYPE content_entity_type;
DROP TYPE agent_changeset_status;
