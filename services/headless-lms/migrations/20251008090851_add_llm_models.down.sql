-- Add down migration script here
ALTER TABLE chatbot_configurations DROP COLUMN model;

DROP TABLE chatbot_configurations_models;
