CREATE TABLE shared_rate_counts (
  key_digest BYTEA NOT NULL CHECK (length(key_digest) = 32),
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (key_digest, window_seconds, window_start)
);
CREATE INDEX shared_rate_counts_window_start ON shared_rate_counts (window_start);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON shared_rate_counts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE shared_rate_counts IS 'Fixed-window event counts shared by every server instance, for limits that must hold across them. Windows that ended over a day ago get hard-deleted during later counting, so there is no deleted_at.';
COMMENT ON COLUMN shared_rate_counts.key_digest IS 'HMAC of what is counted, e.g. a form and a network.';
COMMENT ON COLUMN shared_rate_counts.window_seconds IS 'Length of the window.';
COMMENT ON COLUMN shared_rate_counts.window_start IS 'Start of the window, a multiple of its length since the epoch.';
COMMENT ON COLUMN shared_rate_counts.count IS 'Events counted in the window.';
COMMENT ON COLUMN shared_rate_counts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN shared_rate_counts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';

CREATE TABLE account_form_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  rules_log_only BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON account_form_settings FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE account_form_settings IS 'Admin settings of the account form rules. At most one row; without it, the defaults in the code apply.';
COMMENT ON COLUMN account_form_settings.id IS 'Always true, so the table holds at most one row.';
COMMENT ON COLUMN account_form_settings.rules_log_only IS 'Switch that makes every account form rule log-only.';
COMMENT ON COLUMN account_form_settings.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN account_form_settings.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';

CREATE TYPE account_form_action AS ENUM (
  'signup',
  'signup_code_resend',
  'password_reset',
  'email_change'
);
COMMENT ON TYPE account_form_action IS 'Which account form a submission was for. Each mails an address.';

CREATE TYPE account_form_outcome AS ENUM ('allow', 'drop');
COMMENT ON TYPE account_form_outcome IS 'What the account form rules decided for a submission: handle it as usual, or answer as if it succeeded while mailing nothing.';

CREATE TYPE account_form_list_kind AS ENUM ('address', 'mailbox', 'account', 'domain');
COMMENT ON TYPE account_form_list_kind IS 'What the entries of a list rule are matched against: the exact address; the mailbox, ignoring case, tags and provider aliases; the account id; or the address''s domain and its subdomains.';

CREATE TABLE account_form_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (name <> ''),
  description TEXT NOT NULL DEFAULT '',
  expression TEXT,
  list_kind account_form_list_kind,
  list_entries TEXT [] NOT NULL DEFAULT '{}',
  outcome account_form_outcome NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  log_only BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CHECK ((expression IS NULL) <> (list_kind IS NULL))
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON account_form_rules FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE account_form_rules IS 'Admin-written rules over account form submissions. A rule matches either by a CEL expression or by a list of entries. Never hard-deleted; every save is recorded in account_form_rule_versions.';
COMMENT ON COLUMN account_form_rules.name IS 'A short name for staff.';
COMMENT ON COLUMN account_form_rules.description IS 'Why the rule exists, for staff.';
COMMENT ON COLUMN account_form_rules.expression IS 'A CEL expression over the submission''s signals that evaluates to a boolean. Each signal namespace is a variable, and action holds the account_form_action. An expression that fails to evaluate does not match. NULL for a list rule.';
COMMENT ON COLUMN account_form_rules.list_kind IS 'What list_entries are matched against. NULL for an expression rule.';
COMMENT ON COLUMN account_form_rules.list_entries IS 'Addresses, mailboxes, account ids or domains, by list_kind.';
COMMENT ON COLUMN account_form_rules.outcome IS 'The outcome when the rule matches. Of the matching enforced rules, an allow rule wins.';
COMMENT ON COLUMN account_form_rules.enabled IS 'Whether the rule is evaluated at all.';
COMMENT ON COLUMN account_form_rules.log_only IS 'Whether matches are only logged. A rule is enforced when it is enabled, not log-only, and account_form_settings.rules_log_only is off.';
COMMENT ON COLUMN account_form_rules.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN account_form_rules.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN account_form_rules.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE account_form_rule_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_form_rule_id UUID NOT NULL REFERENCES account_form_rules(id),
  changed_by_user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  expression TEXT,
  list_kind account_form_list_kind,
  list_entries TEXT [] NOT NULL,
  outcome account_form_outcome NOT NULL,
  enabled BOOLEAN NOT NULL,
  log_only BOOLEAN NOT NULL,
  deleted BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX account_form_rule_versions_rule ON account_form_rule_versions (account_form_rule_id, created_at);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON account_form_rule_versions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE account_form_rule_versions IS 'Append-only history of account_form_rules: one row per save, with who saved it. Kept forever.';
COMMENT ON COLUMN account_form_rule_versions.account_form_rule_id IS 'The rule the version belongs to.';
COMMENT ON COLUMN account_form_rule_versions.changed_by_user_id IS 'The admin who saved the version.';
COMMENT ON COLUMN account_form_rule_versions.name IS 'The rule''s name as saved.';
COMMENT ON COLUMN account_form_rule_versions.description IS 'The rule''s description as saved.';
COMMENT ON COLUMN account_form_rule_versions.expression IS 'The rule''s expression as saved.';
COMMENT ON COLUMN account_form_rule_versions.list_kind IS 'The rule''s list kind as saved.';
COMMENT ON COLUMN account_form_rule_versions.list_entries IS 'The rule''s list entries as saved.';
COMMENT ON COLUMN account_form_rule_versions.outcome IS 'The rule''s outcome as saved.';
COMMENT ON COLUMN account_form_rule_versions.enabled IS 'Whether the rule was enabled.';
COMMENT ON COLUMN account_form_rule_versions.log_only IS 'Whether the rule was log-only.';
COMMENT ON COLUMN account_form_rule_versions.deleted IS 'Whether this save deleted the rule.';
COMMENT ON COLUMN account_form_rule_versions.created_at IS 'When the version was saved.';
COMMENT ON COLUMN account_form_rule_versions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';

CREATE TABLE account_form_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action account_form_action NOT NULL,
  outcome account_form_outcome NOT NULL,
  matched_rule_ids UUID [] NOT NULL DEFAULT '{}',
  signals JSONB NOT NULL,
  address_digest BYTEA CHECK (length(address_digest) = 32),
  mailbox_digest BYTEA CHECK (length(mailbox_digest) = 32),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_domain TEXT,
  profile_digest BYTEA CHECK (length(profile_digest) = 32),
  network_prefix CIDR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX account_form_decisions_created_at ON account_form_decisions (created_at);
CREATE INDEX account_form_decisions_address_digest ON account_form_decisions (address_digest, created_at);
CREATE INDEX account_form_decisions_recipient_domain ON account_form_decisions (recipient_domain, created_at);
CREATE INDEX account_form_decisions_profile_digest ON account_form_decisions (profile_digest, created_at);
CREATE INDEX account_form_decisions_network_prefix ON account_form_decisions (network_prefix, created_at);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON account_form_decisions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE account_form_decisions IS 'Admin-only log of the account forms: one row per submission, with the coarse values describing it and what the rules decided. Rows are hard-deleted 90 days after they are written.';
COMMENT ON COLUMN account_form_decisions.action IS 'Which form the submission was for.';
COMMENT ON COLUMN account_form_decisions.outcome IS 'What the rules decided, and the handler did.';
COMMENT ON COLUMN account_form_decisions.matched_rule_ids IS 'Every enabled rule that matched, log-only ones included.';
COMMENT ON COLUMN account_form_decisions.signals IS 'Coarse values describing the submission, as a map of namespaces to fields. Holds no addresses, names or full request headers.';
COMMENT ON COLUMN account_form_decisions.address_digest IS 'HMAC-SHA-256, under the deployment''s form context secret, of the trimmed, lowercased address the submission was about.';
COMMENT ON COLUMN account_form_decisions.mailbox_digest IS 'The address''s mailbox key, as in email_address_mail_budgets.inbox_key.';
COMMENT ON COLUMN account_form_decisions.user_id IS 'The account the submission was about, when there is one.';
COMMENT ON COLUMN account_form_decisions.recipient_domain IS 'The domain of the address the submission was about, lowercased.';
COMMENT ON COLUMN account_form_decisions.profile_digest IS 'HMAC-SHA-256, under the deployment''s form context secret, of the normalised names a signup submitted.';
COMMENT ON COLUMN account_form_decisions.network_prefix IS 'The requester''s /24 (IPv4) or /48 (IPv6) network.';
COMMENT ON COLUMN account_form_decisions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN account_form_decisions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
