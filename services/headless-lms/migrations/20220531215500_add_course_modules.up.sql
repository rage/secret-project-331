-- Add up migration script here
CREATE TABLE course_modules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses,
  name VARCHAR(255) NOT NULL,
  order_number INTEGER NOT NULL
);
COMMENT ON TABLE course_modules IS 'A module is a collection of chapters which can be used to categorise the chapters of a course.';
COMMENT ON COLUMN course_modules.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_modules.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_modules.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_modules.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_modules.course_id IS 'A module belongs to a course.';
COMMENT ON COLUMN course_modules.name IS 'The name of the module.';
COMMENT ON COLUMN course_modules.order_number IS 'Defines the order in which the modules are shown.';
ALTER TABLE chapters
ADD COLUMN module UUID REFERENCES course_modules;
COMMENT ON COLUMN chapters.module IS 'The module the chapter is a part of. If null, the chapter is part of the default module.';
