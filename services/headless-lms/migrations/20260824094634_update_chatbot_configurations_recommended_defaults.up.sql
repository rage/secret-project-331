UPDATE chatbot_configurations
SET
  use_tools = TRUE,
  suggest_next_messages = TRUE
WHERE
  deleted_at IS NULL
  AND ((default_chatbot = TRUE AND course_id IS NOT NULL) OR publicly_accessible = TRUE);

-- Azure search queries a per-course index, so it stays off where there is no course to search.
UPDATE chatbot_configurations
SET
  use_azure_search = TRUE,
  maintain_azure_search_index = TRUE
WHERE
  deleted_at IS NULL
  AND course_id IS NOT NULL
  AND (default_chatbot = TRUE OR publicly_accessible = TRUE);
