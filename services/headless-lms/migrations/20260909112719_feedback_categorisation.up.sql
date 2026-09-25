CREATE TABLE feedback_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR(255) NOT NULL
);

CREATE UNIQUE INDEX unique_category_name ON feedback_categories (name, deleted_at) NULLS NOT DISTINCT;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON feedback_categories FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE feedback_categories IS 'Categories for user-submitted feedback.';
COMMENT ON COLUMN feedback_categories.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN feedback_categories.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN feedback_categories.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN feedback_categories.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN feedback_categories.name IS 'A name that describes this feedback category and is displayed to the user.';

ALTER TABLE feedback
ADD COLUMN category_id UUID REFERENCES feedback_categories (id);

COMMENT ON COLUMN feedback.category_id IS 'References the feedback_categories entry of the category assigned to this feedback.';
