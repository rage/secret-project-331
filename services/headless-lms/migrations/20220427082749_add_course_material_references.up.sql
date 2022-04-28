-- Add up migration script here
create table material_references (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses,
  citation_key TEXT NOT NULL UNIQUE,
  reference TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);
CREATE UNIQUE INDEX citation_key_uniqueness ON material_references (citation_key)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON material_references FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE material_references IS 'References to scientific publications of which teachers use in their course materials to refer to.';
