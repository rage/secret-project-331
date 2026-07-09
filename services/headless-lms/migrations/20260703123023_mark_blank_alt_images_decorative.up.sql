-- Backfill: mark legacy blank-alt images as decorative.
--
-- The core/image block now has a "Mark as decorative" checkbox (attributes.isDecorative).
-- Before it existed, authors made an image decorative by clearing its alt text to blank
-- (uploads seed alt = 'Add alt', so a blank alt is a deliberate clearing). This walks every
-- Gutenberg block at any nesting depth in every column that stores block arrays and, for each
-- core/image block whose alt key exists and is blank (empty or whitespace only), sets
-- attributes.isDecorative = true. Blocks with the 'Add alt' placeholder, non-blank alt text, or
-- no alt key at all are left untouched.
--
-- One-shot data fix: the helper function is dropped at the end.

CREATE FUNCTION mark_blank_alt_images_decorative(blocks jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    result    jsonb := '[]'::jsonb;
    block     jsonb;
    new_block jsonb;
BEGIN
    -- Only arrays are block lists; NULL / non-array input is returned unchanged.
    IF jsonb_typeof(blocks) IS DISTINCT FROM 'array' THEN
        RETURN blocks;
    END IF;

    FOR block IN SELECT jsonb_array_elements(blocks) LOOP
        new_block := block;

        IF jsonb_typeof(block) = 'object' THEN
            -- Mark blank-alt core/image blocks decorative. Require the alt key to exist (so
            -- images without alt are untouched) and to be blank after trimming.
            IF block ->> 'name' = 'core/image'
               AND jsonb_typeof(block -> 'attributes') = 'object'
               AND (block -> 'attributes') ? 'alt'
               AND btrim(block #>> '{attributes,alt}') = ''
            THEN
                new_block := jsonb_set(new_block, '{attributes,isDecorative}', 'true'::jsonb, true);
            END IF;

            -- Recurse into innerBlocks when present.
            IF jsonb_typeof(new_block -> 'innerBlocks') = 'array' THEN
                new_block := jsonb_set(
                    new_block,
                    '{innerBlocks}',
                    mark_blank_alt_images_decorative(new_block -> 'innerBlocks'),
                    true
                );
            END IF;
        END IF;

        -- Append in document order.
        result := result || jsonb_build_array(new_block);
    END LOOP;

    RETURN result;
END;
$$;

-- Each UPDATE uses a cheap LIKE pre-filter so rows without image blocks are never rewritten, and
-- an IS DISTINCT FROM guard so unchanged rows aren't written (avoids the pages content-search
-- trigger's heavy branch and needless updated_at churn).

-- pages.content (NOT NULL)
UPDATE pages
SET content = mark_blank_alt_images_decorative(content)
WHERE content::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(content) IS DISTINCT FROM content;

-- page_history.content (NOT NULL, large append-only table). Compute the transform once per
-- candidate row via a CTE instead of calling the recursive function twice.
WITH candidates AS (
    SELECT id, mark_blank_alt_images_decorative(content) AS new_content
    FROM page_history
    WHERE content::text LIKE '%core/image%'
)
UPDATE page_history p
SET content = c.new_content
FROM candidates c
WHERE p.id = c.id
  AND c.new_content IS DISTINCT FROM p.content;

-- exercise_tasks.assignment (NULLABLE)
UPDATE exercise_tasks
SET assignment = mark_blank_alt_images_decorative(assignment)
WHERE assignment IS NOT NULL
  AND assignment::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(assignment) IS DISTINCT FROM assignment;

-- exercise_tasks.public_spec (NULLABLE)
UPDATE exercise_tasks
SET public_spec = mark_blank_alt_images_decorative(public_spec)
WHERE public_spec IS NOT NULL
  AND public_spec::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(public_spec) IS DISTINCT FROM public_spec;

-- exercise_tasks.private_spec (NULLABLE)
UPDATE exercise_tasks
SET private_spec = mark_blank_alt_images_decorative(private_spec)
WHERE private_spec IS NOT NULL
  AND private_spec::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(private_spec) IS DISTINCT FROM private_spec;

-- exercise_tasks.model_solution_spec (NULLABLE)
UPDATE exercise_tasks
SET model_solution_spec = mark_blank_alt_images_decorative(model_solution_spec)
WHERE model_solution_spec IS NOT NULL
  AND model_solution_spec::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(model_solution_spec) IS DISTINCT FROM model_solution_spec;

-- email_templates.content (NULLABLE)
UPDATE email_templates
SET content = mark_blank_alt_images_decorative(content)
WHERE content IS NOT NULL
  AND content::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(content) IS DISTINCT FROM content;

-- exams.instructions (NOT NULL)
UPDATE exams
SET instructions = mark_blank_alt_images_decorative(instructions)
WHERE instructions::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(instructions) IS DISTINCT FROM instructions;

-- course_specific_research_consent_forms.content (NOT NULL)
UPDATE course_specific_research_consent_forms
SET content = mark_blank_alt_images_decorative(content)
WHERE content::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(content) IS DISTINCT FROM content;

-- peer_or_self_review_configs.review_instructions (NULLABLE)
UPDATE peer_or_self_review_configs
SET review_instructions = mark_blank_alt_images_decorative(review_instructions)
WHERE review_instructions IS NOT NULL
  AND review_instructions::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(review_instructions) IS DISTINCT FROM review_instructions;

-- partners_blocks.content (NULLABLE)
UPDATE partners_blocks
SET content = mark_blank_alt_images_decorative(content)
WHERE content IS NOT NULL
  AND content::text LIKE '%core/image%'
  AND mark_blank_alt_images_decorative(content) IS DISTINCT FROM content;

DROP FUNCTION mark_blank_alt_images_decorative(jsonb);
