ALTER TABLE chatbot_page_sync_statuses DROP CONSTRAINT chatbot_page_sync_statuses_one_status_per_page;
ALTER TABLE chatbot_configurations DROP COLUMN use_azure_search;
ALTER TABLE chatbot_configurations DROP COLUMN maintain_azure_search_index;
ALTER TABLE chatbot_configurations DROP COLUMN use_semantic_reranking;
ALTER TABLE chatbot_configurations DROP COLUMN show_citations;
