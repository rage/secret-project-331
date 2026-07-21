CREATE TABLE exercise_slide_submission_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_slide_submission_id UUID NOT NULL REFERENCES exercise_slide_submissions(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_exercise_slide_submission_shares_submission_id ON exercise_slide_submission_shares(exercise_slide_submission_id);
CREATE INDEX idx_exercise_slide_submission_shares_created_by ON exercise_slide_submission_shares(created_by);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_slide_submission_shares FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_slide_submission_shares IS 'Shareable-link tokens for existing exercise slide submissions (the share capability behind the exercise-services client share endpoint).';
COMMENT ON COLUMN exercise_slide_submission_shares.id IS 'Unique, unguessable token; forms part of the shareable submission URL.';
COMMENT ON COLUMN exercise_slide_submission_shares.exercise_slide_submission_id IS 'The submission this share links to.';
COMMENT ON COLUMN exercise_slide_submission_shares.created_by IS 'User who created the share.';
COMMENT ON COLUMN exercise_slide_submission_shares.created_at IS 'Timestamp when the share was created.';
COMMENT ON COLUMN exercise_slide_submission_shares.updated_at IS 'Timestamp when the share was last updated by trigger_set_timestamp.';
COMMENT ON COLUMN exercise_slide_submission_shares.deleted_at IS 'Soft delete timestamp. Null means active (revoked shares are soft-deleted).';
