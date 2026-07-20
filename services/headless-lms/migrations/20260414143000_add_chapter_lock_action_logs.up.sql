CREATE TABLE chapter_lock_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  chapter_id UUID NOT NULL REFERENCES chapters(id),
  status chapter_locking_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_chapter_lock_action_logs_target_user_id ON chapter_lock_action_logs(target_user_id);
CREATE INDEX idx_chapter_lock_action_logs_course_id ON chapter_lock_action_logs(course_id);
CREATE INDEX idx_chapter_lock_action_logs_chapter_id ON chapter_lock_action_logs(chapter_id);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chapter_lock_action_logs FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chapter_lock_action_logs IS 'Stores teacher-initiated chapter lock/unlock actions for students.';
COMMENT ON COLUMN chapter_lock_action_logs.id IS 'Unique identifier for a chapter lock action log entry.';
COMMENT ON COLUMN chapter_lock_action_logs.actor_user_id IS 'Teacher user id who performed the action. Nullable for system actions.';
COMMENT ON COLUMN chapter_lock_action_logs.target_user_id IS 'Student user id whose chapter lock status was changed.';
COMMENT ON COLUMN chapter_lock_action_logs.course_id IS 'Course where the chapter lock action happened.';
COMMENT ON COLUMN chapter_lock_action_logs.chapter_id IS 'Chapter whose lock status was changed.';
COMMENT ON COLUMN chapter_lock_action_logs.status IS 'Chapter locking status after the teacher action (same values as user_chapter_locking_statuses.status).';
COMMENT ON COLUMN chapter_lock_action_logs.created_at IS 'Timestamp when the log entry was created.';
COMMENT ON COLUMN chapter_lock_action_logs.updated_at IS 'Timestamp when the log entry was last updated by trigger_set_timestamp.';
COMMENT ON COLUMN chapter_lock_action_logs.deleted_at IS 'Soft delete timestamp. Null means active log entry.';
