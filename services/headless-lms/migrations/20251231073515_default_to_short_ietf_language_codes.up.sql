-- Shorten IETF language codes to their short form (e.g., en-US -> en, fi-FI -> fi)
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
