ALTER TABLE chatbot_page_sync_statuses
ADD CONSTRAINT chatbot_page_sync_statuses_one_status_per_page UNIQUE NULLS NOT DISTINCT (page_id, deleted_at);
ALTER TABLE chatbot_configurations
ADD COLUMN use_azure_search boolean NOT NULL DEFAULT false;
ALTER TABLE chatbot_configurations
ADD COLUMN maintain_azure_search_index boolean NOT NULL DEFAULT false;
-- If use_azure_search is true, then maintain_azure_search_index must also be true
ALTER TABLE chatbot_configurations
ADD CONSTRAINT chatbot_configurations_maintain_azure_search_index_if_use_azure_search CHECK (
    use_azure_search = FALSE
    OR maintain_azure_search_index = TRUE
  );
