CREATE TABLE mailchimp_language_code_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_mailing_list_access_token_id UUID NOT NULL REFERENCES marketing_mailing_list_access_tokens(id),
  old_language_code VARCHAR(10) NOT NULL,
  new_language_code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX mailchimp_language_code_mappings_unique ON mailchimp_language_code_mappings (
  marketing_mailing_list_access_token_id,
  old_language_code
)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON mailchimp_language_code_mappings FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE mailchimp_language_code_mappings IS 'Maps old course language codes to Mailchimp language codes for a given mailing list access token.';
COMMENT ON COLUMN mailchimp_language_code_mappings.id IS 'A unique identifier.';
COMMENT ON COLUMN mailchimp_language_code_mappings.marketing_mailing_list_access_token_id IS 'References the marketing mailing list access token this mapping belongs to.';
COMMENT ON COLUMN mailchimp_language_code_mappings.old_language_code IS 'The original language code.';
COMMENT ON COLUMN mailchimp_language_code_mappings.new_language_code IS 'The language code used in Mailchimp.';
COMMENT ON COLUMN mailchimp_language_code_mappings.created_at IS 'Timestamp when the entry was created.';
COMMENT ON COLUMN mailchimp_language_code_mappings.updated_at IS 'Timestamp when the entry was last updated. Automatically maintained by trigger.';
COMMENT ON COLUMN mailchimp_language_code_mappings.deleted_at IS 'Timestamp when the entry was marked as deleted. If null, the record is not deleted.';
