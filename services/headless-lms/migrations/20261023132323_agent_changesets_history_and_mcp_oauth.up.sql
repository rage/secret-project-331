CREATE TYPE agent_changeset_status AS ENUM ('open', 'published', 'discarded', 'expired');
COMMENT ON TYPE agent_changeset_status IS 'Lifecycle of an agent changeset. Only open changesets take new writes; the other states are final.';

CREATE TYPE agent_changeset_entity_type AS ENUM (
  'page',
  'chapter',
  'module',
  'course_settings',
  'glossary_term',
  'reference'
);
COMMENT ON TYPE agent_changeset_entity_type IS 'Kind of course content an agent changeset entity holds. page covers both the page metadata and its blocks; module covers both the structure fields and the settings of a course_modules row; course_settings is the courses row itself.';

CREATE TYPE agent_changeset_entity_operation AS ENUM ('create', 'update', 'delete');
COMMENT ON TYPE agent_changeset_entity_operation IS 'What publishing an agent changeset entity does to the live entity.';

CREATE TYPE entity_history_change_reason AS ENUM ('saved', 'deleted', 'restored');
COMMENT ON TYPE entity_history_change_reason IS 'Why a chapter_history, course_module_history or course_settings_history row was written.';

CREATE TABLE agent_changesets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  status agent_changeset_status NOT NULL DEFAULT 'open',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID REFERENCES users(id),
  CONSTRAINT agent_changesets_published_has_publisher CHECK (
    (status = 'published') = (
      published_at IS NOT NULL
      AND published_by IS NOT NULL
    )
  )
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON agent_changesets FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_agent_changesets_one_open_per_user_and_course ON agent_changesets (user_id, course_id)
WHERE status = 'open'
  AND deleted_at IS NULL;
CREATE INDEX idx_agent_changesets_course ON agent_changesets (course_id, status)
WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_changesets_open_expiry ON agent_changesets (expires_at)
WHERE status = 'open'
  AND deleted_at IS NULL;

COMMENT ON TABLE agent_changesets IS 'Unpublished course content changes one user''s AI agent has staged in one course. Every agent write lands in the user''s open changeset for the course; nothing reaches students until the changeset is published, by the agent with the material:publish scope or by the user on the review page.';
COMMENT ON COLUMN agent_changesets.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN agent_changesets.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN agent_changesets.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN agent_changesets.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN agent_changesets.user_id IS 'The user whose agent staged the changes. Only this user can publish or discard the changeset.';
COMMENT ON COLUMN agent_changesets.course_id IS 'The course every entity in the changeset belongs to.';
COMMENT ON COLUMN agent_changesets.status IS 'open while it takes writes; published, discarded and expired are final.';
COMMENT ON COLUMN agent_changesets.expires_at IS 'When an open changeset expires: 14 days after its last write. The daily expiry job discards it after that.';
COMMENT ON COLUMN agent_changesets.published_at IS 'When the changeset was published. Set exactly when status is published.';
COMMENT ON COLUMN agent_changesets.published_by IS 'The user who published the changeset. Set exactly when status is published.';

CREATE TABLE agent_changeset_entities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changeset_id UUID NOT NULL REFERENCES agent_changesets(id),
  entity_type agent_changeset_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  operation agent_changeset_entity_operation NOT NULL,
  base_snapshot JSONB,
  after_snapshot JSONB,
  base_version_id UUID,
  risk_reasons JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT agent_changeset_entities_unique_entity UNIQUE (changeset_id, entity_type, entity_id),
  CONSTRAINT agent_changeset_entities_snapshots_match_operation CHECK (
    (
      operation = 'create'
      AND base_snapshot IS NULL
      AND after_snapshot IS NOT NULL
    )
    OR (
      operation = 'update'
      AND base_snapshot IS NOT NULL
      AND after_snapshot IS NOT NULL
    )
    OR (
      operation = 'delete'
      AND base_snapshot IS NOT NULL
      AND after_snapshot IS NULL
    )
  ),
  CONSTRAINT agent_changeset_entities_risk_reasons_array CHECK (jsonb_typeof(risk_reasons) = 'array')
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON agent_changeset_entities FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_agent_changeset_entities_entity ON agent_changeset_entities (entity_type, entity_id);

COMMENT ON TABLE agent_changeset_entities IS 'One page or entity an agent changeset changes, with its full staged state. Reads of the staged state overlay these rows on the live content; publishing writes after_snapshot through the same save paths the web UI uses. Rows are removed when a revert brings the entity back to its base state.';
COMMENT ON COLUMN agent_changeset_entities.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN agent_changeset_entities.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN agent_changeset_entities.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN agent_changeset_entities.changeset_id IS 'The changeset this entity belongs to.';
COMMENT ON COLUMN agent_changeset_entities.entity_type IS 'Which table entity_id points to, and which snapshot shape the snapshots have.';
COMMENT ON COLUMN agent_changeset_entities.entity_id IS 'Id of the live entity. For a create, the id the server assigned when staging, which publishing keeps.';
COMMENT ON COLUMN agent_changeset_entities.operation IS 'Whether publishing creates, updates or deletes the entity.';
COMMENT ON COLUMN agent_changeset_entities.base_snapshot IS 'The live entity, in the snapshot shape of entity_type, when it was first staged. Publishing is rejected if the live entity no longer matches it. Null for creates.';
COMMENT ON COLUMN agent_changeset_entities.after_snapshot IS 'The staged entity in the snapshot shape of entity_type. Null for deletes.';
COMMENT ON COLUMN agent_changeset_entities.base_version_id IS 'Id of the latest page_history, chapter_history, course_module_history or course_settings_history row of the entity when it was first staged, if it had one. Null for creates and for entities without history rows.';
COMMENT ON COLUMN agent_changeset_entities.risk_reasons IS 'Why publishing this entity needs the user''s confirmation on the review page, as an array of {code, message, consequence}. Empty for routine changes.';

CREATE TABLE agent_changeset_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changeset_id UUID NOT NULL REFERENCES agent_changesets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  oauth_client_id UUID REFERENCES oauth_clients(id),
  oauth_grant_id UUID,
  client_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  ops JSONB NOT NULL,
  summary TEXT,
  entity_changes JSONB NOT NULL,
  revert_of_call_id UUID REFERENCES agent_changeset_calls(id),
  CONSTRAINT agent_changeset_calls_entity_changes_array CHECK (jsonb_typeof(entity_changes) = 'array')
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON agent_changeset_calls FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_agent_changeset_calls_changeset ON agent_changeset_calls (changeset_id, created_at);
CREATE INDEX idx_agent_changeset_calls_user ON agent_changeset_calls (user_id, created_at);

COMMENT ON TABLE agent_changeset_calls IS 'Audit log of agent write calls: one row per call that staged changes. A call is also the unit an agent reverts.';
COMMENT ON COLUMN agent_changeset_calls.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN agent_changeset_calls.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN agent_changeset_calls.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN agent_changeset_calls.changeset_id IS 'The changeset the call staged its changes into.';
COMMENT ON COLUMN agent_changeset_calls.user_id IS 'The user the agent acted for.';
COMMENT ON COLUMN agent_changeset_calls.oauth_client_id IS 'The OAuth client (agent) that made the call.';
COMMENT ON COLUMN agent_changeset_calls.oauth_grant_id IS 'oauth_user_client_scopes.id of the grant the call''s token came from. Not a foreign key: revoking a grant deletes that row, and the audit trail must survive it.';
COMMENT ON COLUMN agent_changeset_calls.client_name IS 'The client''s display name at the time of the call, shown as "via <client_name>" in history.';
COMMENT ON COLUMN agent_changeset_calls.tool_name IS 'The MCP tool that was called.';
COMMENT ON COLUMN agent_changeset_calls.ops IS 'The operations the call was given, as the agent sent them.';
COMMENT ON COLUMN agent_changeset_calls.summary IS 'Short human-readable description of what the call changed.';
COMMENT ON COLUMN agent_changeset_calls.entity_changes IS 'Array of {entity_type, entity_id, operation, before, after}: each entity the call touched, with its full snapshot just before and just after the call (null where the entity did not exist). Reverting the call restores the before snapshots.';
COMMENT ON COLUMN agent_changeset_calls.revert_of_call_id IS 'If this call reverted an earlier call, that call.';

CREATE TABLE chapter_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  snapshot JSONB NOT NULL,
  change_reason entity_history_change_reason NOT NULL,
  restored_from_id UUID REFERENCES chapter_history(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  agent_client_name TEXT,
  agent_changeset_id UUID REFERENCES agent_changesets(id),
  CONSTRAINT chapter_history_restore_has_source CHECK ((change_reason = 'restored') = (restored_from_id IS NOT NULL)),
  CONSTRAINT chapter_history_agent_fields_together CHECK ((agent_client_name IS NULL) = (agent_changeset_id IS NULL))
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chapter_history FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_chapter_history_chapter ON chapter_history (chapter_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_chapter_history_course ON chapter_history (course_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_chapter_history_changeset ON chapter_history (agent_changeset_id)
WHERE agent_changeset_id IS NOT NULL;

COMMENT ON TABLE chapter_history IS 'A full snapshot of a chapter after every save, from the web UI and from agents alike, like page_history for pages. A chapter can be restored to any of these.';
COMMENT ON COLUMN chapter_history.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chapter_history.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chapter_history.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chapter_history.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chapter_history.chapter_id IS 'The chapter the snapshot is of.';
COMMENT ON COLUMN chapter_history.course_id IS 'The chapter''s course, for listing a course''s history.';
COMMENT ON COLUMN chapter_history.snapshot IS 'The chapter''s fields after the save, in the chapter snapshot shape agent changesets also use.';
COMMENT ON COLUMN chapter_history.change_reason IS 'Whether the chapter was saved, deleted or restored from an earlier row.';
COMMENT ON COLUMN chapter_history.restored_from_id IS 'For a restore, the history row that was restored.';
COMMENT ON COLUMN chapter_history.author_user_id IS 'The user who made the change, directly or through an agent.';
COMMENT ON COLUMN chapter_history.agent_client_name IS 'For a change an agent made, the agent''s client name ("via <client>"). Null for changes made in the web UI.';
COMMENT ON COLUMN chapter_history.agent_changeset_id IS 'For a change an agent made, the changeset it was published from. Rows with the same changeset belong to one change.';

CREATE TABLE course_module_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  snapshot JSONB NOT NULL,
  change_reason entity_history_change_reason NOT NULL,
  restored_from_id UUID REFERENCES course_module_history(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  agent_client_name TEXT,
  agent_changeset_id UUID REFERENCES agent_changesets(id),
  CONSTRAINT course_module_history_restore_has_source CHECK ((change_reason = 'restored') = (restored_from_id IS NOT NULL)),
  CONSTRAINT course_module_history_agent_fields_together CHECK ((agent_client_name IS NULL) = (agent_changeset_id IS NULL))
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_history FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_course_module_history_module ON course_module_history (course_module_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_course_module_history_course ON course_module_history (course_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_course_module_history_changeset ON course_module_history (agent_changeset_id)
WHERE agent_changeset_id IS NOT NULL;

COMMENT ON TABLE course_module_history IS 'A full snapshot of a course module after every save, from the web UI and from agents alike. A module can be restored to any of these.';
COMMENT ON COLUMN course_module_history.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_module_history.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_module_history.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_module_history.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_module_history.course_module_id IS 'The module the snapshot is of.';
COMMENT ON COLUMN course_module_history.course_id IS 'The module''s course, for listing a course''s history.';
COMMENT ON COLUMN course_module_history.snapshot IS 'The module''s fields after the save, in the module snapshot shape agent changesets also use.';
COMMENT ON COLUMN course_module_history.change_reason IS 'Whether the module was saved, deleted or restored from an earlier row.';
COMMENT ON COLUMN course_module_history.restored_from_id IS 'For a restore, the history row that was restored.';
COMMENT ON COLUMN course_module_history.author_user_id IS 'The user who made the change, directly or through an agent.';
COMMENT ON COLUMN course_module_history.agent_client_name IS 'For a change an agent made, the agent''s client name ("via <client>"). Null for changes made in the web UI.';
COMMENT ON COLUMN course_module_history.agent_changeset_id IS 'For a change an agent made, the changeset it was published from. Rows with the same changeset belong to one change.';

CREATE TABLE course_settings_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  snapshot JSONB NOT NULL,
  change_reason entity_history_change_reason NOT NULL,
  restored_from_id UUID REFERENCES course_settings_history(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  agent_client_name TEXT,
  agent_changeset_id UUID REFERENCES agent_changesets(id),
  CONSTRAINT course_settings_history_restore_has_source CHECK ((change_reason = 'restored') = (restored_from_id IS NOT NULL)),
  CONSTRAINT course_settings_history_agent_fields_together CHECK ((agent_client_name IS NULL) = (agent_changeset_id IS NULL))
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_settings_history FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_course_settings_history_course ON course_settings_history (course_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_course_settings_history_changeset ON course_settings_history (agent_changeset_id)
WHERE agent_changeset_id IS NOT NULL;

COMMENT ON TABLE course_settings_history IS 'A full snapshot of a course''s settings after every save, from the web UI and from agents alike. The settings can be restored to any of these.';
COMMENT ON COLUMN course_settings_history.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_settings_history.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_settings_history.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_settings_history.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_settings_history.course_id IS 'The course whose settings the snapshot is of.';
COMMENT ON COLUMN course_settings_history.snapshot IS 'The course''s settings after the save, in the course settings snapshot shape agent changesets also use.';
COMMENT ON COLUMN course_settings_history.change_reason IS 'Whether the settings were saved or restored from an earlier row. Never deleted: deleting a course is not a settings change.';
COMMENT ON COLUMN course_settings_history.restored_from_id IS 'For a restore, the history row that was restored.';
COMMENT ON COLUMN course_settings_history.author_user_id IS 'The user who made the change, directly or through an agent.';
COMMENT ON COLUMN course_settings_history.agent_client_name IS 'For a change an agent made, the agent''s client name ("via <client>"). Null for changes made in the web UI.';
COMMENT ON COLUMN course_settings_history.agent_changeset_id IS 'For a change an agent made, the changeset it was published from. Rows with the same changeset belong to one change.';

ALTER TABLE page_history
ADD COLUMN agent_client_name TEXT,
  ADD COLUMN agent_changeset_id UUID REFERENCES agent_changesets(id),
  ADD CONSTRAINT page_history_agent_fields_together CHECK ((agent_client_name IS NULL) = (agent_changeset_id IS NULL));

CREATE INDEX idx_page_history_changeset ON page_history (agent_changeset_id)
WHERE agent_changeset_id IS NOT NULL;

COMMENT ON COLUMN page_history.agent_client_name IS 'For a change an agent made, the agent''s client name ("via <client>"). Null for changes made in the web UI.';
COMMENT ON COLUMN page_history.agent_changeset_id IS 'For a change an agent made, the changeset it was published from. Rows with the same changeset belong to one change.';

ALTER TABLE oauth_clients
ADD COLUMN metadata_document_fetched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN client_uri TEXT,
  ADD COLUMN logo_uri TEXT,
  ADD CONSTRAINT oauth_clients_metadata_document_client_id_is_https_url CHECK (
    metadata_document_fetched_at IS NULL
    OR client_id ~ '^https://'
  );

COMMENT ON COLUMN oauth_clients.metadata_document_fetched_at IS 'For a client registered through a Client ID Metadata Document, when the document at the client_id URL was last fetched; the row is a cache of that document and is refreshed from it. Null for clients registered by hand.';
COMMENT ON COLUMN oauth_clients.client_uri IS 'Home page of the client from its metadata document, shown on the consent screen.';
COMMENT ON COLUMN oauth_clients.logo_uri IS 'Logo URL of the client from its metadata document.';

ALTER TABLE oauth_user_client_scopes
ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE,
  ADD CONSTRAINT oauth_user_client_scopes_id_key UNIQUE (id);

COMMENT ON COLUMN oauth_user_client_scopes.id IS 'Stable identifier of the grant, used to revoke it and in audit logs. A new grant after a revoke gets a new id.';
COMMENT ON COLUMN oauth_user_client_scopes.last_used_at IS 'When an access token from this grant was last used, at minute resolution. Shown with the grant on the user''s account page.';

ALTER TABLE oauth_auth_codes
ADD COLUMN resource TEXT;

COMMENT ON COLUMN oauth_auth_codes.resource IS 'The RFC 8707 resource indicator of the authorization request. Tokens issued from the code are bound to it as their audience.';

CREATE FUNCTION are_valid_oauth_audiences_or_null(arr TEXT []) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v TEXT;
BEGIN IF arr IS NULL THEN RETURN TRUE;
END IF;
FOREACH v IN ARRAY arr LOOP IF v IS NULL
OR v !~* '^https?://[^\s#]+$' THEN RETURN FALSE;
END IF;
END LOOP;
RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION are_valid_oauth_audiences_or_null(TEXT []) IS 'Returns TRUE if the array is NULL or every entry is an absolute http(s) URL without a fragment. Audiences are resource server URLs, which are plain http on development hosts such as project-331.local.';

ALTER TABLE oauth_access_tokens DROP CONSTRAINT audience_uris_valid,
  ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_audiences_or_null(audience));

ALTER TABLE oauth_refresh_tokens DROP CONSTRAINT audience_uris_valid,
  ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_audiences_or_null(audience));
