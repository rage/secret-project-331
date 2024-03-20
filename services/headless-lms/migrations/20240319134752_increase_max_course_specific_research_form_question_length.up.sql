ALTER TABLE course_specific_consent_form_questions ALTER COLUMN question TYPE VARCHAR(8192);
UPDATE course_specific_research_consent_forms SET content = REPLACE(content::text, 'moocfi/research-consent-checkbox', 'moocfi/research-consent-question')::jsonb;

