-- Add up migration script here
CREATE TABLE playground_examples (
  id uuid not null default uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  name varchar(255) not null,
  url varchar(255) not null,
  width INTEGER not null,
  data jsonb not null,
  UNIQUE (data, name, width, url)
);
