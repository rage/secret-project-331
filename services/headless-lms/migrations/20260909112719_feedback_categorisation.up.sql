CREATE TABLE feedback_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR(255) UNIQUE NOT NULL
);

ALTER TABLE feedback
ADD COLUMN category_id UUID REFERENCES feedback_categories (id);
