-- Add up migration script here
CREATE TYPE exercise_repository_status AS ENUM ('pending', 'success', 'failure');
CREATE TABLE exercise_repositories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID REFERENCES courses,
  exam_id UUID REFERENCES exams,
  url VARCHAR(255) NOT NULL,
  deploy_key VARCHAR(1024),
  status exercise_repository_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  CHECK ((course_id IS NULL) <> (exam_id IS NULL))
);
COMMENT ON TABLE exercise_repositories IS 'A git repository that contains exercises.';
COMMENT ON COLUMN exercise_repositories.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_repositories.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_repositories.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_repositories.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_repositories.course_id IS 'Each repository is related to some course. The same repository can be added to different courses and managed separately.';
COMMENT ON COLUMN exercise_repositories.url IS 'The git url for the repository.';
COMMENT ON COLUMN exercise_repositories.deploy_key IS 'If set, the key will be used to access the repository.';
COMMENT ON COLUMN exercise_repositories.status IS 'The status of the process for adding the repository.';
COMMENT ON COLUMN exercise_repositories.error_message IS 'If something went wrong when processing this repository, this column may contain information about the error.';
CREATE TABLE repository_exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  repository_id UUID REFERENCES exercise_repositories NOT NULL,
  part VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  checksum BYTEA NOT NULL,
  download_url VARCHAR(255) NOT NULL
);
COMMENT ON TABLE repository_exercises IS 'An exercise that corresponds to an exercise in a git repository.';
COMMENT ON COLUMN repository_exercises.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN repository_exercises.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN repository_exercises.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN repository_exercises.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN repository_exercises.repository_id IS 'Each repository exercise belongs to a repository.';
COMMENT ON COLUMN repository_exercises.part IS 'Exercises are separated into parts, such as "part01".';
COMMENT ON COLUMN repository_exercises.name IS 'The name of the exercise, such as "01_hello_world".';
COMMENT ON COLUMN repository_exercises.checksum IS 'A checksum calculated from the exercise directory, used to detect updates to the exercise.';
