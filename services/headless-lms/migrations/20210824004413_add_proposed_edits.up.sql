-- Add up migration script here
CREATE TYPE proposal_status AS ENUM('pending', 'accepted', 'rejected');
CREATE TABLE proposed_page_edits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses,
  page_id UUID NOT NULL REFERENCES pages,
  user_id UUID REFERENCES users,
  pending BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON proposed_page_edits FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE proposed_page_edits IS 'Concrete suggestions to improve the contents of a single course material page sent in by students, which can be automatically applied. Consists of one or more edits to individual course material blocks.';
COMMENT ON COLUMN proposed_page_edits.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN proposed_page_edits.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN proposed_page_edits.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN proposed_page_edits.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN proposed_page_edits.course_id IS 'The course that contains the material the proposal is for.';
COMMENT ON COLUMN proposed_page_edits.page_id IS 'The page that contains the material the proposal is for.';
COMMENT ON COLUMN proposed_page_edits.user_id IS 'The user that sent the proposal.';
CREATE TABLE proposed_block_edits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposed_page_edits,
  block_id UUID NOT NULL,
  block_attribute TEXT NOT NULL,
  original_text TEXT NOT NULL,
  changed_text TEXT NOT NULL,
  status proposal_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON proposed_block_edits FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE proposed_block_edits IS 'A suggestion to change the contents of a single block, part of some set of proposed edits to a page.';
COMMENT ON COLUMN proposed_block_edits.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN proposed_block_edits.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN proposed_block_edits.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN proposed_block_edits.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN proposed_block_edits.proposal_id IS 'A student can send in proposal this edit is a part of.';
COMMENT ON COLUMN proposed_block_edits.block_id IS 'The course material block that the proposal is for.';
COMMENT ON COLUMN proposed_block_edits.block_attribute IS 'The block attribute that contains the text that is being changed.';
COMMENT ON COLUMN proposed_block_edits.original_text IS 'The original text of the block.';
COMMENT ON COLUMN proposed_block_edits.changed_text IS 'The changed text of the block.';
COMMENT ON COLUMN proposed_block_edits.status IS 'The status of the proposal.';
