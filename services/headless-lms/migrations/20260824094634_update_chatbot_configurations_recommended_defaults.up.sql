UPDATE chatbot_configurations
SET
  use_tools = TRUE,
  use_azure_search = TRUE,
  maintain_azure_search_index = TRUE,
  suggest_next_messages = TRUE
WHERE
  deleted_at IS NULL
  AND ((default_chatbot = TRUE AND course_id IS NOT NULL) OR publicly_accessible = TRUE);
