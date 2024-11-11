-- Add up migration script here
CREATE TABLE partners_block (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  content JSONB,
  course_instance_id UUID REFERENCES course_instances NOT NULL
);
COMMENT ON TABLE partners_block IS 'A partners block table contains the content of the partners block created in the Gutenberg Editor which are images, text and links.';
