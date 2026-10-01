CREATE TABLE email_layouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  html TEXT NOT NULL CHECK (strpos(html, '{{CONTENT}}') > 0)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON email_layouts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_email_layouts_single_live ON email_layouts ((TRUE))
WHERE deleted_at IS NULL;

COMMENT ON TABLE email_layouts IS 'The HTML shell every outgoing email''s HTML part is wrapped in. At most one live row; with none, the sender uses the default shell bundled in the code. The plain-text part is never wrapped. Picked up by the sender on its next batch, so replacing the row needs no restart.';
COMMENT ON COLUMN email_layouts.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN email_layouts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN email_layouts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN email_layouts.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN email_layouts.html IS 'A complete HTML document. {{CONTENT}} is replaced with the rendered email body, which is already HTML; {{SUBJECT}} with the HTML-escaped subject. Email clients ignore most external CSS, so styles should be inline or in a <style> element.';
