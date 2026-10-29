CREATE TYPE agent_changeset_status AS ENUM ('open', 'published', 'discarded', 'expired');
COMMENT ON TYPE agent_changeset_status IS 'Lifecycle of an agent changeset. Only open changesets take new writes; the other states are final.';

CREATE TYPE content_entity_type AS ENUM (
  'page',
  'chapter',
  'module',
  'course_settings',
  'glossary_term',
  'reference',
  'course_default_review_config'
);
COMMENT ON TYPE content_entity_type IS 'Kind of course content entity that agent changesets stage and entity history records. page covers both the page metadata and its blocks; module covers both the structure fields and the settings of a course_modules row; course_settings is the courses row itself; course_default_review_config is the peer_or_self_review_configs row exercises use unless they have their own.';

CREATE TYPE entity_history_change_reason AS ENUM ('saved', 'deleted', 'restored');
COMMENT ON TYPE entity_history_change_reason IS 'Why an entity_history row was written.';

CREATE TABLE agent_changesets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  status agent_changeset_status NOT NULL DEFAULT 'open',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  revision INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT agent_changesets_published_has_published_at CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON agent_changesets FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_agent_changesets_one_open_per_user_and_course ON agent_changesets (user_id, course_id)
WHERE status = 'open';
CREATE INDEX idx_agent_changesets_user_course ON agent_changesets (user_id, course_id, created_at DESC);

COMMENT ON TABLE agent_changesets IS 'Unpublished course content changes one user''s AI agent has staged in one course. Every agent write lands in the user''s open changeset for the course; nothing reaches students until the changeset is published, by the agent with the material:publish scope or by the user on the review page. No deleted_at: a changeset ends in a final status instead, and its rows stay as the record of what was staged.';
COMMENT ON COLUMN agent_changesets.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN agent_changesets.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN agent_changesets.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN agent_changesets.user_id IS 'The user whose agent staged the changes. Only this user can publish or discard the changeset.';
COMMENT ON COLUMN agent_changesets.course_id IS 'The course every entity in the changeset belongs to.';
COMMENT ON COLUMN agent_changesets.status IS 'open while it takes writes; published, discarded and expired are final. An open changeset past expires_at stays open here until the next write to the course marks it expired; read it through agent_changeset_current_status.';
COMMENT ON COLUMN agent_changesets.expires_at IS 'When an open changeset expires: 14 days after its last write.';
COMMENT ON COLUMN agent_changesets.published_at IS 'When the changeset was published. Set exactly when status is published.';
COMMENT ON COLUMN agent_changesets.revision IS 'Incremented by every change to the staged entities. The review page publishes only the revision the user reviewed.';

CREATE FUNCTION agent_changeset_is_open(
  status agent_changeset_status,
  expires_at TIMESTAMP WITH TIME ZONE
) RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
SELECT status = 'open'
  AND expires_at > now() $$;

COMMENT ON FUNCTION agent_changeset_is_open(agent_changeset_status, TIMESTAMP WITH TIME ZONE) IS 'Whether an agent changeset takes writes and can be published or discarded: open and not past its expires_at. Every query that filters on open changesets uses it.';

CREATE FUNCTION agent_changeset_current_status(
  status agent_changeset_status,
  expires_at TIMESTAMP WITH TIME ZONE
) RETURNS agent_changeset_status LANGUAGE SQL STABLE AS $$
SELECT CASE
    WHEN status = 'open'
    AND NOT agent_changeset_is_open(status, expires_at) THEN 'expired'
    ELSE status
  END $$;

COMMENT ON FUNCTION agent_changeset_current_status(agent_changeset_status, TIMESTAMP WITH TIME ZONE) IS 'The status of an agent changeset now: expired for an open one past its expires_at, which the status column only records at the next write to the course.';

CREATE TABLE agent_changeset_entities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changeset_id UUID NOT NULL REFERENCES agent_changesets(id),
  entity_type content_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  base_snapshot JSONB,
  after_snapshot JSONB,
  label TEXT NOT NULL,
  risk_reasons JSONB NOT NULL DEFAULT '[]',
  revision INTEGER NOT NULL,
  CONSTRAINT agent_changeset_entities_unique_entity UNIQUE (changeset_id, entity_type, entity_id),
  CONSTRAINT agent_changeset_entities_has_snapshot CHECK (
    base_snapshot IS NOT NULL
    OR after_snapshot IS NOT NULL
  ),
  CONSTRAINT agent_changeset_entities_risk_reasons_array CHECK (jsonb_typeof(risk_reasons) = 'array')
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON agent_changeset_entities FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_agent_changeset_entities_entity ON agent_changeset_entities (entity_type, entity_id);

COMMENT ON TABLE agent_changeset_entities IS 'One page or entity an agent changeset changes, with its full staged state. Reads of the staged state overlay these rows on the live content; publishing writes after_snapshot back, pages through the same page save the CMS uses. Rows are removed when a later call stages the entity back to its base state or the user discards the entity. No deleted_at: a row is the current staged state, so it is deleted outright, and agent_changeset_call_entities keeps the history.';
COMMENT ON COLUMN agent_changeset_entities.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN agent_changeset_entities.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN agent_changeset_entities.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN agent_changeset_entities.changeset_id IS 'The changeset this entity belongs to.';
COMMENT ON COLUMN agent_changeset_entities.entity_type IS 'Which table entity_id points to, and which snapshot shape the snapshots have.';
COMMENT ON COLUMN agent_changeset_entities.entity_id IS 'Id of the live entity. For a create, the id the server assigned when staging, which publishing keeps.';
COMMENT ON COLUMN agent_changeset_entities.base_snapshot IS 'The live entity, in the snapshot shape of entity_type, when it was first staged. Publishing is rejected if the live entity no longer matches it. Null for creates.';
COMMENT ON COLUMN agent_changeset_entities.after_snapshot IS 'The staged entity in the snapshot shape of entity_type. Null for deletes.';
COMMENT ON COLUMN agent_changeset_entities.label IS 'What people call the entity: the page title, chapter, module or course name, glossary term or citation key of after_snapshot, or of base_snapshot for deletes. Kept so that listings need not read the snapshots.';
COMMENT ON COLUMN agent_changeset_entities.revision IS 'The changeset revision of the last write to this row. A write call is refused if the row changed after the call read it, so parallel calls never overwrite each other.';
COMMENT ON COLUMN agent_changeset_entities.risk_reasons IS 'Why publishing this entity needs the user''s confirmation on the review page, as an array of {code, ...facts}: the rule each reason breaks and the facts that rule found. Empty for routine changes.';

CREATE TABLE agent_changeset_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changeset_id UUID NOT NULL REFERENCES agent_changesets(id),
  oauth_client_id UUID NOT NULL REFERENCES oauth_clients(id),
  oauth_grant_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  ops JSONB NOT NULL,
  summary TEXT,
  revert_of_call_id UUID REFERENCES agent_changeset_calls(id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON agent_changeset_calls FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_agent_changeset_calls_changeset ON agent_changeset_calls (changeset_id, created_at);

COMMENT ON TABLE agent_changeset_calls IS 'Audit log of agent write calls: one row per call that staged changes. A call is also the unit an agent reverts. No deleted_at: an audit log is never edited or removed.';
COMMENT ON COLUMN agent_changeset_calls.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN agent_changeset_calls.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN agent_changeset_calls.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN agent_changeset_calls.changeset_id IS 'The changeset the call staged its changes into. Its user is the user the agent acted for.';
COMMENT ON COLUMN agent_changeset_calls.oauth_client_id IS 'The OAuth client (agent) that made the call.';
COMMENT ON COLUMN agent_changeset_calls.oauth_grant_id IS 'oauth_user_client_scopes.id of the grant the call''s token came from. Not a foreign key: revoking a grant deletes that row, and the audit trail must survive it.';
COMMENT ON COLUMN agent_changeset_calls.client_name IS 'The client''s display name at the time of the call. History rows written by publishing the call''s changes show it as "via <client_name>".';
COMMENT ON COLUMN agent_changeset_calls.tool_name IS 'The MCP tool that was called.';
COMMENT ON COLUMN agent_changeset_calls.ops IS 'The operations the call was given, as the agent sent them.';
COMMENT ON COLUMN agent_changeset_calls.summary IS 'Short human-readable description of what the call changed.';
COMMENT ON COLUMN agent_changeset_calls.revert_of_call_id IS 'If this call reverted an earlier call, that call.';

CREATE TABLE agent_changeset_call_entities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  call_id UUID NOT NULL REFERENCES agent_changeset_calls(id),
  entity_type content_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  label TEXT NOT NULL,
  before_snapshot JSONB,
  after_digest TEXT,
  CONSTRAINT agent_changeset_call_entities_unique_entity UNIQUE (call_id, entity_type, entity_id),
  CONSTRAINT agent_changeset_call_entities_has_snapshot CHECK (
    before_snapshot IS NOT NULL
    OR after_digest IS NOT NULL
  )
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON agent_changeset_call_entities FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_agent_changeset_call_entities_entity ON agent_changeset_call_entities (entity_id);

COMMENT ON TABLE agent_changeset_call_entities IS 'Each entity an agent write call touched, with its full snapshot just before the call and a digest of its snapshot just after it. Reverting the call restores the before snapshots. No deleted_at: part of the call''s audit log.';
COMMENT ON COLUMN agent_changeset_call_entities.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN agent_changeset_call_entities.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN agent_changeset_call_entities.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN agent_changeset_call_entities.call_id IS 'The call that touched the entity.';
COMMENT ON COLUMN agent_changeset_call_entities.entity_type IS 'Which table entity_id points to, and which snapshot shape the snapshots have.';
COMMENT ON COLUMN agent_changeset_call_entities.entity_id IS 'Id of the entity; the course id for course settings.';
COMMENT ON COLUMN agent_changeset_call_entities.label IS 'What people call the entity just after the call, or just before it for deletes. Kept so that history listings need not read the snapshots.';
COMMENT ON COLUMN agent_changeset_call_entities.before_snapshot IS 'The entity just before the call. Null if it did not exist.';
COMMENT ON COLUMN agent_changeset_call_entities.after_digest IS 'Hex BLAKE3 digest (headless_lms_utils::stable_digest) of the entity''s snapshot JSON just after the call. Null if the call deleted it. Reverting compares it with the entity''s current snapshot to refuse undoing later changes.';

CREATE TABLE entity_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  entity_type content_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id),
  snapshot JSONB NOT NULL,
  change_reason entity_history_change_reason NOT NULL,
  restored_from_id UUID REFERENCES entity_history(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  agent_call_id UUID REFERENCES agent_changeset_calls(id),
  CONSTRAINT entity_history_entity_type_has_history CHECK (
    entity_type IN (
      'chapter',
      'module',
      'course_settings',
      'course_default_review_config'
    )
  ),
  CONSTRAINT entity_history_restore_has_source CHECK ((change_reason = 'restored') = (restored_from_id IS NOT NULL))
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON entity_history FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_entity_history_entity ON entity_history (entity_id, created_at DESC);

COMMENT ON TABLE entity_history IS 'A full snapshot of a chapter, course module, course''s settings or course default review config after every save, from the web UI and from agents alike, like page_history for pages. The entity can be restored to any of these. No deleted_at: history is append-only.';
COMMENT ON COLUMN entity_history.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN entity_history.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN entity_history.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN entity_history.entity_type IS 'Which table entity_id points to, and which snapshot shape snapshot has.';
COMMENT ON COLUMN entity_history.entity_id IS 'Id of the chapter, module or peer_or_self_review_configs row; the course id for course settings.';
COMMENT ON COLUMN entity_history.course_id IS 'The course the entity belongs to.';
COMMENT ON COLUMN entity_history.snapshot IS 'The entity''s fields after the change, in the snapshot shape agent changesets also use.';
COMMENT ON COLUMN entity_history.change_reason IS 'Whether the entity was saved, deleted or restored from an earlier row. Course settings are never deleted.';
COMMENT ON COLUMN entity_history.restored_from_id IS 'For a restore, the history row that was restored.';
COMMENT ON COLUMN entity_history.author_user_id IS 'The user who made the change, directly or through an agent.';
COMMENT ON COLUMN entity_history.agent_call_id IS 'For a change an agent made, the latest call that staged it before it was published; its client_name says which agent. Null for changes made in the web UI.';

CREATE INDEX idx_course_module_completions_course_module ON course_module_completions (course_module_id)
WHERE deleted_at IS NULL;

CREATE INDEX idx_feedback_page ON feedback (page_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_block_feedback_feedback ON block_feedback (feedback_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_proposed_page_edits_page ON proposed_page_edits (page_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_proposed_block_edits_proposal ON proposed_block_edits (proposal_id)
WHERE deleted_at IS NULL;

ALTER TABLE page_history
ADD COLUMN agent_call_id UUID REFERENCES agent_changeset_calls(id);

COMMENT ON COLUMN page_history.agent_call_id IS 'For a change an agent made, the latest call that staged it before it was published; its client_name says which agent. Null for changes made in the web UI.';

ALTER TABLE chapters DROP CONSTRAINT unique_chapters_chapter_number_course_id_when_not_deleted,
  ADD CONSTRAINT unique_chapters_chapter_number_course_id_when_not_deleted UNIQUE NULLS NOT DISTINCT (chapter_number, course_id, deleted_at) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE course_modules DROP CONSTRAINT course_modules_order_number_uniqueness,
  ADD CONSTRAINT course_modules_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, order_number, deleted_at) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE pages DROP CONSTRAINT pages_order_number_uniqueness,
  ADD CONSTRAINT pages_order_number_uniqueness UNIQUE NULLS NOT DISTINCT (
    course_id,
    exam_id,
    chapter_id,
    order_number,
    deleted_at
  ) DEFERRABLE INITIALLY IMMEDIATE,
  DROP CONSTRAINT unique_pages_url_path_course_id_when_not_deleted,
  ADD CONSTRAINT unique_pages_url_path_course_id_when_not_deleted UNIQUE NULLS NOT DISTINCT (url_path, exam_id, course_id, deleted_at) DEFERRABLE INITIALLY IMMEDIATE;
COMMENT ON CONSTRAINT unique_chapters_chapter_number_course_id_when_not_deleted ON chapters IS 'Deferrable so that publishing an agent changeset can swap chapter numbers within one transaction.';
COMMENT ON CONSTRAINT course_modules_order_number_uniqueness ON course_modules IS 'Deferrable so that publishing an agent changeset and saving the module editor can swap module order numbers within one transaction.';
COMMENT ON CONSTRAINT pages_order_number_uniqueness ON pages IS 'Deferrable so that publishing an agent changeset can swap page order numbers within one transaction.';
COMMENT ON CONSTRAINT unique_pages_url_path_course_id_when_not_deleted ON pages IS 'Deferrable so that publishing an agent changeset can swap page paths within one transaction.';
ALTER TABLE material_references DROP CONSTRAINT citation_key_uniqueness,
  ADD CONSTRAINT citation_key_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, citation_key, deleted_at) DEFERRABLE INITIALLY IMMEDIATE;
COMMENT ON CONSTRAINT citation_key_uniqueness ON material_references IS 'Deferrable so that publishing an agent changeset can move a citation key to another reference within one transaction.';
ALTER TABLE chapters
ALTER CONSTRAINT chapters_front_page_id_fkey DEFERRABLE INITIALLY IMMEDIATE;
COMMENT ON CONSTRAINT chapters_front_page_id_fkey ON chapters IS 'Deferrable so that publishing an agent changeset can write a new chapter before the front page it points to.';

ALTER TABLE oauth_clients
ADD COLUMN metadata_document_fetched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN client_uri TEXT,
  ADD CONSTRAINT oauth_clients_metadata_document_client_id_is_https_url CHECK (
    metadata_document_fetched_at IS NULL
    OR client_id ~ '^https://'
  );

COMMENT ON COLUMN oauth_clients.metadata_document_fetched_at IS 'For a client registered through a Client ID Metadata Document, when the document at the client_id URL was last fetched; the row is a cache of that document and is refreshed from it. Null for clients registered by hand.';
COMMENT ON COLUMN oauth_clients.client_uri IS 'Home page of the client from its metadata document, shown on the consent screen.';

ALTER TABLE oauth_user_client_scopes
ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE,
  ADD CONSTRAINT oauth_user_client_scopes_id_key UNIQUE (id);

COMMENT ON COLUMN oauth_user_client_scopes.id IS 'Stable identifier of the grant, used to revoke it and in audit logs. A new grant after a revoke gets a new id.';
COMMENT ON COLUMN oauth_user_client_scopes.last_used_at IS 'When an access token from this grant was last used, at minute resolution. Shown with the grant on the user''s account page.';

ALTER TABLE oauth_auth_codes
ADD COLUMN resource TEXT;

COMMENT ON COLUMN oauth_auth_codes.resource IS 'The RFC 8707 resource indicator of the authorization request. Tokens issued from the code are bound to it as their audience.';

-- Audiences come from the server's configuration, where the MCP endpoint is plain http on
-- development hosts such as project-331.local.
ALTER TABLE oauth_access_tokens DROP CONSTRAINT audience_uris_valid;
ALTER TABLE oauth_refresh_tokens DROP CONSTRAINT audience_uris_valid;

CREATE OR REPLACE FUNCTION is_valid_oauth_uri(uri TEXT) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN IF uri IS NULL
  OR trim(uri) = ''
  OR uri ~ '\s'
  OR uri LIKE '%#%'
  OR uri ~* '^(javascript|data|file|vbscript):' THEN RETURN FALSE;
END IF;

IF uri ~* '^https://[^\s]+$' THEN RETURN TRUE;

  -- http on loopback for dev
ELSIF uri ~* '^http://((localhost(\.localdomain)?)|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?(?:/[^\s]*)?$' THEN RETURN TRUE;

ELSIF uri ~* '^(?!https?://)[A-Za-z][A-Za-z0-9+.\-]*:(//)?[^\s]+$' THEN RETURN TRUE;

ELSIF uri ~* '^urn:[A-Za-z0-9][A-Za-z0-9\-]{0,31}:[^\s]+$' THEN RETURN TRUE;
END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION is_valid_oauth_uri(TEXT) IS 'Validates OAuth-safe redirect/identifier URIs: https, http loopback (dev), custom schemes other than javascript, data, file and vbscript, and URNs.';
