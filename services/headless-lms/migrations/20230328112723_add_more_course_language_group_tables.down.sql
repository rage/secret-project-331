ALTER TABLE exercises DROP constraint check_exercise_language_group_id_defined;
ALTER TABLE pages DROP constraint check_page_language_group_id_defined;
ALTER TABLE exercises DROP COLUMN exercise_language_group_id;
ALTER TABLE pages DROP COLUMN page_language_group_id;
DROP TABLE exercise_language_groups;
DROP TABLE page_language_groups;