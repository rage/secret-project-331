CREATE TABLE email_layouts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  language TEXT CHECK (language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$'),
  html TEXT NOT NULL CHECK (strpos(html, '{{CONTENT}}') > 0),
  button_background_color TEXT NOT NULL DEFAULT '#1F6964' CHECK (button_background_color ~ '^#[0-9A-Fa-f]{6}$'),
  button_text_color TEXT NOT NULL DEFAULT '#FFFFFF' CHECK (button_text_color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON email_layouts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_email_layouts_live_language ON email_layouts (lower(language)) NULLS NOT DISTINCT
WHERE deleted_at IS NULL;

COMMENT ON TABLE email_layouts IS 'The HTML shells outgoing emails'' HTML parts are wrapped in, one live row per language at most. An email gets the row matching its language exactly, else the one matching its primary subtag (fi for fi-FI), else the row without a language, else the default shell bundled in the code. The plain-text part is never wrapped. Picked up by the sender on its next batch, so replacing a row needs no restart.';
COMMENT ON COLUMN email_layouts.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN email_layouts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN email_layouts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN email_layouts.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN email_layouts.language IS 'BCP 47 tag of the emails this shell is for, matched case-insensitively against the template''s or its course''s language. Null for the fallback shell used when no row matches.';
COMMENT ON COLUMN email_layouts.html IS 'A complete HTML document. {{CONTENT}} is replaced with the rendered email body, which is already HTML; {{SUBJECT}}, {{PREHEADER}} (the first paragraph as text, for the inbox preview) and {{LANGUAGE}} (the template''s or its course''s language tag, empty when unknown) with HTML-escaped values. Email clients ignore most external CSS, so styles should be inline or in a <style> element.';
COMMENT ON COLUMN email_layouts.button_background_color IS 'Button background as #RRGGBB, written inline into each button, because Outlook desktop and clients that strip <style> ignore the shell''s CSS for it.';
COMMENT ON COLUMN email_layouts.button_text_color IS 'Button label colour as #RRGGBB, written inline like button_background_color.';

ALTER TABLE email_deliveries
ADD COLUMN test_subject TEXT,
ADD COLUMN test_content JSONB,
ADD CONSTRAINT email_deliveries_test_send_complete CHECK ((test_subject IS NULL) = (test_content IS NULL)),
ADD CONSTRAINT email_deliveries_test_send_to_account CHECK (
    test_content IS NULL
    OR user_id IS NOT NULL
  );

CREATE INDEX email_deliveries_test_sends_idx ON email_deliveries (user_id, created_at)
WHERE test_content IS NOT NULL;

COMMENT ON COLUMN email_deliveries.test_subject IS 'Subject of a test send from the email editor, set together with test_content; null for every other delivery. A test send is rendered from these and the sample values in placeholders instead of the template''s saved subject and content and the values derived from the recipient''s account.';
COMMENT ON COLUMN email_deliveries.test_content IS 'Body of a test send from the email editor, in the format of email_templates.content. See test_subject.';

-- Email bodies from the seed and early hand-loaded templates use an older block shape ("type",
-- "drop_cap", lists as a "values" HTML string). The sender reads only the shape the CMS email editor
-- saves, so convert them.
CREATE FUNCTION pg_temp.to_current_gutenberg_blocks(blocks JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE converted JSONB;
BEGIN
SELECT COALESCE(
    jsonb_agg(
      CASE
      WHEN jsonb_typeof(b) <> 'object' THEN b
      ELSE (b - 'type' - 'attributes' - 'innerBlocks') || jsonb_build_object(
        'name',
        COALESCE(b->'name', b->'type'),
        'attributes',
        CASE
          WHEN attrs ? 'drop_cap' THEN (attrs - 'drop_cap' - 'values') || jsonb_build_object('dropCap', attrs->'drop_cap')
          ELSE attrs - 'values'
        END,
        'innerBlocks',
        CASE
          WHEN COALESCE(b->>'name', b->>'type') = 'core/list'
          AND attrs ? 'values'
          AND jsonb_array_length(child_blocks) = 0 THEN (
            SELECT COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'name',
                    'core/list-item',
                    'isValid',
                    TRUE,
                    'clientId',
                    uuid_generate_v4(),
                    'attributes',
                    jsonb_build_object('content', item [1]),
                    'innerBlocks',
                    '[]'::jsonb
                  )
                ),
                '[]'::jsonb
              )
            FROM regexp_matches(attrs->>'values', '<li>(.*?)</li>', 'g') AS item
          )
          ELSE pg_temp.to_current_gutenberg_blocks(child_blocks)
        END
      )
      END
      ORDER BY ord
    ),
    '[]'::jsonb
  ) INTO converted
FROM jsonb_array_elements(blocks) WITH ORDINALITY AS t(b, ord)
  CROSS JOIN LATERAL (
    SELECT CASE
        WHEN jsonb_typeof(b) = 'object'
        AND jsonb_typeof(b->'innerBlocks') = 'array' THEN b->'innerBlocks'
        ELSE '[]'::jsonb
      END AS child_blocks,
      CASE
        WHEN jsonb_typeof(b->'attributes') = 'object' THEN b->'attributes'
        ELSE '{}'::jsonb
      END AS attrs
  ) AS lateral_inner;
RETURN converted;
END;
$$;

UPDATE email_templates
SET content = pg_temp.to_current_gutenberg_blocks(content)
WHERE jsonb_typeof(content) = 'array';
