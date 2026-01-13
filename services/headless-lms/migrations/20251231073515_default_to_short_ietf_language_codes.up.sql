-- Shorten IETF language codes to their short form (e.g., en-US -> en, fi-FI -> fi)
-- First, drop the existing CHECK constraints that require full IETF format
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_language_code_check;
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_language_check;
ALTER TABLE course_module_completions DROP CONSTRAINT IF EXISTS course_module_completions_completion_language_check;

-- If the above didn't work, find and drop constraints dynamically
-- Update the data to use short language codes
UPDATE courses
SET language_code = SPLIT_PART(language_code, '-', 1)
WHERE language_code LIKE '%-%';

UPDATE exams
SET language = SPLIT_PART(language, '-', 1)
WHERE language LIKE '%-%';

UPDATE course_module_completions
SET completion_language = SPLIT_PART(completion_language, '-', 1)
WHERE completion_language LIKE '%-%';

UPDATE email_templates
SET language = SPLIT_PART(language, '-', 1)
WHERE language IS NOT NULL
  AND language LIKE '%-%';

-- Recreate the CHECK constraints to allow both short and full IETF language codes
-- Pattern: ^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$
-- This allows: en, fi (short) or en-US, fi-FI, en-Latn-US (full)
ALTER TABLE courses
ADD CONSTRAINT courses_language_code_check CHECK (
    language_code ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$'
  );

ALTER TABLE exams
ADD CONSTRAINT exams_language_check CHECK (
    language IS NULL
    OR language ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$'
  );

ALTER TABLE course_module_completions
ADD CONSTRAINT course_module_completions_completion_language_check CHECK (
    completion_language ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$'
  );
