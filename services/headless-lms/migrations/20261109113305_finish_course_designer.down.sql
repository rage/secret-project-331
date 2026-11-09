-- Deliveries reference these templates, so relabel and soft-delete them instead of deleting.
-- deleted_at must differ per row because of unique_email_templates_type_language_general.
UPDATE email_templates t
SET email_template_type = 'generic',
  deleted_at = NOW() - (r.n * INTERVAL '1 microsecond')
FROM (
    SELECT id,
      row_number() OVER (
        ORDER BY id
      ) AS n
    FROM email_templates
    WHERE email_template_type = 'course_designer_weekly_digest'
  ) r
WHERE t.id = r.id;

CREATE TYPE email_template_type_old AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic',
  'confirm_email_code',
  'credit_registration_account_linking',
  'verify_email_address',
  'credit_registration_action_needed',
  'credit_registration_registered'
);
ALTER TABLE email_templates
ALTER COLUMN email_template_type TYPE email_template_type_old USING (
    email_template_type::text::email_template_type_old
  );
DROP TYPE email_template_type;
ALTER TYPE email_template_type_old
RENAME TO email_template_type;
COMMENT ON TYPE email_template_type IS 'Type of email template: generic templates do not support automated placeholder replacements, others do.';

UPDATE chatbot_configurations
SET enabled_tool_categories = array_remove(enabled_tool_categories, 'course_planning');

CREATE TYPE chatbot_tool_category_old AS ENUM (
  'course_material',
  'course_info',
  'course_catalog',
  'interaction',
  'admin_support_accounts',
  'admin_support_courses',
  'admin_support_learning_progress',
  'admin_support_academic_integrity'
);
ALTER TABLE chatbot_configurations
ALTER COLUMN enabled_tool_categories DROP DEFAULT;
ALTER TABLE chatbot_configurations
ALTER COLUMN enabled_tool_categories TYPE chatbot_tool_category_old [] USING (
    enabled_tool_categories::text []::chatbot_tool_category_old []
  );
ALTER TABLE chatbot_configurations
ALTER COLUMN enabled_tool_categories
SET DEFAULT '{}';
DROP TYPE chatbot_tool_category;
ALTER TYPE chatbot_tool_category_old
RENAME TO chatbot_tool_category;

DROP INDEX chatbot_configurations_only_one_course_designer_assistant;
ALTER TABLE chatbot_configurations DROP COLUMN course_designer_assistant;

DROP INDEX chatbot_conversations_course_designer_plan_user_created_at_idx;
ALTER TABLE chatbot_conversations DROP COLUMN course_designer_plan_id;

DROP TABLE course_designer_plan_section_statuses;
DROP TYPE course_designer_section_status;

ALTER TABLE course_designer_plan_stage_tasks DROP COLUMN assignee_user_id;

ALTER TABLE course_designer_plan_members DROP COLUMN receives_weekly_digest;

ALTER TABLE course_designer_plans DROP COLUMN great_mooc_vision,
  DROP COLUMN created_course_id;
