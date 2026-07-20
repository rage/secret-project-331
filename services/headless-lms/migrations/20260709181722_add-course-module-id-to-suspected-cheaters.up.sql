-- Records which module completion triggered the flag, so the review UI can show the threshold that
-- actually applied (flagging uses the completed module's threshold, which may differ from the
-- default module's). Nullable: kept optional so a course without the expected default module can't
-- block the backfill.
ALTER TABLE suspected_cheaters
  ADD COLUMN course_module_id UUID REFERENCES course_modules (id);

COMMENT ON COLUMN suspected_cheaters.course_module_id IS 'The module completion that triggered the flag; its threshold is the one the student beat. Backfilled to the course default module for rows created before this column existed.';

-- Backfill existing rows to the course's default module (the module with no name).
UPDATE suspected_cheaters sc
SET course_module_id = cm.id
FROM course_modules cm
WHERE cm.course_id = sc.course_id
  AND cm.name IS NULL
  AND cm.deleted_at IS NULL
  AND sc.course_module_id IS NULL;
