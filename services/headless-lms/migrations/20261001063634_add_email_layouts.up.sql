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
COMMENT ON COLUMN email_layouts.html IS 'A complete HTML document. {{CONTENT}} is replaced with the rendered email body, which is already HTML; {{SUBJECT}}, {{PREHEADER}} (the first paragraph as text, for the inbox preview) and {{LANGUAGE}} (the template''s or its course''s language tag, empty when unknown) with HTML-escaped values. Email clients ignore most external CSS, so styles should be inline or in a <style> element.';

-- Email bodies from the seed and early hand-loaded templates use an older block shape ("type",
-- "drop_cap", lists as a "values" HTML string). The sender reads only the shape the CMS email editor
-- saves, so convert them.
CREATE FUNCTION pg_temp.to_current_gutenberg_blocks(blocks JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE converted JSONB;
BEGIN
SELECT COALESCE(
    jsonb_agg(
      (b - 'type' - 'attributes' - 'innerBlocks') || jsonb_build_object(
        'name',
        COALESCE(b->'name', b->'type'),
        'attributes',
        CASE
          WHEN b->'attributes' ? 'drop_cap' THEN ((b->'attributes') - 'drop_cap') || jsonb_build_object('dropCap', b->'attributes'->'drop_cap')
          ELSE COALESCE(b->'attributes', '{}'::jsonb) - 'values'
        END,
        'innerBlocks',
        CASE
          WHEN COALESCE(b->>'name', b->>'type') = 'core/list'
          AND b->'attributes' ? 'values'
          AND COALESCE(jsonb_array_length(b->'innerBlocks'), 0) = 0 THEN (
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
            FROM regexp_matches(b->'attributes'->>'values', '<li>(.*?)</li>', 'g') AS item
          )
          ELSE pg_temp.to_current_gutenberg_blocks(COALESCE(b->'innerBlocks', '[]'::jsonb))
        END
      )
      ORDER BY ord
    ),
    '[]'::jsonb
  ) INTO converted
FROM jsonb_array_elements(blocks) WITH ORDINALITY AS t(b, ord);
RETURN converted;
END;
$$;

UPDATE email_templates
SET content = pg_temp.to_current_gutenberg_blocks(content)
WHERE jsonb_typeof(content) = 'array';
