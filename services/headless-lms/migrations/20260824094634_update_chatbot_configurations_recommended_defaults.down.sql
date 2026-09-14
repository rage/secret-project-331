UPDATE chatbot_configurations
SET
  use_tools = FALSE,
  use_azure_search = FALSE,
  maintain_azure_search_index = FALSE,
  suggest_next_messages = FALSE
WHERE
  deleted_at IS NULL
  AND ((default_chatbot = TRUE AND course_id IS NOT NULL) OR publicly_accessible = TRUE);
