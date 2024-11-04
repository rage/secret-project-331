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
-- New configuration options for chatbot_configurations
ALTER TABLE chatbot_configurations
ADD COLUMN use_semantic_reranking boolean NOT NULL DEFAULT false;
ALTER TABLE chatbot_configurations
ADD COLUMN hide_citations boolean NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chatbot_configurations.use_azure_search IS 'Whether to use Azure Search for chatbot search. Requires maintain_azure_search_index to be true.';
COMMENT ON COLUMN chatbot_configurations.maintain_azure_search_index IS 'If, true, whenever a page is created, updated, or deleted, the the system will sync its contents to the the Azure Search index. If false, the chatbot will not update the Azure Search index. Note that at the moment the system does not delete unused indexes, so yoy want to optimize index costs, you may want to delete the indexes from the Azure portal.';
COMMENT ON COLUMN chatbot_configurations.use_semantic_reranking IS 'Whether to use semantic reranking for chatbot search. Requires the feature to be enabled in Azure.';
COMMENT ON COLUMN chatbot_configurations.hide_citations IS 'Whether to show citations to user in the chatbot interface. If true, citations will be hidden on the frontend.';
