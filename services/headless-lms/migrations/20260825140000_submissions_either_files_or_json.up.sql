CREATE TYPE answer_kind AS ENUM ('json', 'file');

ALTER TABLE exercise_task_submissions
  ADD COLUMN answer_kind answer_kind NOT NULL DEFAULT 'json';
-- NOT VALID, and never validated: data_json is nullable and long predates answer_kind, so a single
-- legacy contentless answer would abort a validating scan of the platform's largest table. Inserts
-- and updates are still checked, and attach_answer_data tolerates such a row.
ALTER TABLE exercise_task_submissions
  ADD CONSTRAINT exercise_task_submissions_json_answer_has_data
  CHECK (answer_kind <> 'json' OR data_json IS NOT NULL) NOT VALID;

ALTER TABLE rejected_exercise_task_submissions
  ADD COLUMN answer_kind answer_kind NOT NULL DEFAULT 'json';
ALTER TABLE rejected_exercise_task_submissions
  ALTER COLUMN data_json DROP NOT NULL;
-- NOT VALID: data_json was NOT NULL until the statement above, so every existing row conforms.
-- Inserts and updates are still checked.
ALTER TABLE rejected_exercise_task_submissions
  ADD CONSTRAINT rejected_exercise_task_submissions_json_answer_has_data
  CHECK (answer_kind <> 'json' OR data_json IS NOT NULL) NOT VALID;

COMMENT ON COLUMN exercise_task_submissions.answer_kind IS 'Whether the answer is the opaque blob in data_json, or the files in exercise_task_submission_files with data_json holding the exercise service''s metadata about them.';
COMMENT ON COLUMN rejected_exercise_task_submissions.answer_kind IS 'Mirrors exercise_task_submissions.answer_kind for the rejected copy of the answer.';
COMMENT ON TABLE exercise_task_submission_files IS 'The files a task submission was made from. When the submission''s answer_kind is ''file'', these rows are the answer itself; when ''json'', they merely accompany it.';

ALTER TABLE file_uploads ADD COLUMN size_bytes BIGINT;
COMMENT ON COLUMN file_uploads.size_bytes IS 'Size of the stored object in bytes, measured while receiving it. Null for rows created before the column existed.';

ALTER TABLE exercise_service_client_uploads
RENAME TO exercise_answer_uploads;
ALTER INDEX exercise_service_client_uploads_pkey RENAME TO exercise_answer_uploads_pkey;
ALTER INDEX uq_exercise_service_client_uploads_file_upload_id RENAME TO uq_exercise_answer_uploads_file_upload_id;
ALTER INDEX idx_exercise_service_client_uploads_lookup RENAME TO idx_exercise_answer_uploads_lookup;
ALTER INDEX idx_exercise_service_client_uploads_created RENAME TO idx_exercise_answer_uploads_created;
ALTER TABLE exercise_answer_uploads
RENAME CONSTRAINT exercise_service_client_uploads_file_upload_id_fkey TO exercise_answer_uploads_file_upload_id_fkey;
ALTER TABLE exercise_answer_uploads
RENAME CONSTRAINT exercise_service_client_uploads_exercise_id_fkey TO exercise_answer_uploads_exercise_id_fkey;
ALTER TABLE exercise_answer_uploads
RENAME CONSTRAINT exercise_service_client_uploads_user_id_fkey TO exercise_answer_uploads_user_id_fkey;

CREATE TYPE answer_upload_origin AS ENUM ('native_client', 'iframe');
ALTER TABLE exercise_answer_uploads
ADD COLUMN origin answer_upload_origin NOT NULL DEFAULT 'native_client';
ALTER TABLE exercise_answer_uploads
ALTER COLUMN origin DROP DEFAULT;

COMMENT ON TABLE exercise_answer_uploads IS 'Files uploaded to be named in an exercise answer, bound to the uploader and the exercise so a submit can verify the naming. Membership in this table is what scopes the answer upload reaper: the reaper must never consider any other file_uploads row. file_uploads is shared with CMS media, organization images and certificates, which have no binding here, so a reaper widened to file_uploads would silently delete real user data. This narrow scope is a load-bearing safety property, not an optimization. Retention is per origin.';
COMMENT ON COLUMN exercise_answer_uploads.origin IS 'The upload channel that created the row. Selects the reaper''s retention window: one hour for native_client, seven days for iframe.';

ALTER TABLE exercise_service_info DROP COLUMN answer_files_endpoint_path;

ALTER TABLE exercise_service_info
ADD COLUMN supports_native_client BOOLEAN NOT NULL DEFAULT FALSE;

-- Derived before the drop so the client API keeps serving the same services across the migration,
-- rather than serving none until service-info-fetcher next re-fetches every service.
UPDATE exercise_service_info
SET supports_native_client = TRUE
WHERE build_user_answer_endpoint_path IS NOT NULL;

ALTER TABLE exercise_service_info DROP COLUMN build_user_answer_endpoint_path;

ALTER TABLE exercise_service_info
ADD COLUMN produces_file_answers BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN exercise_service_info.supports_native_client IS 'Whether this service declares that it can be answered from a native (non-browser) client. Gates the exercise-services client API: it serves only services that declare it.';
COMMENT ON COLUMN exercise_service_info.produces_file_answers IS 'Whether this service declares that its answers consist of uploaded files rather than JSON. Independent of supports_native_client, which is about the client that answers rather than the shape of the answer.';

CREATE TABLE rejected_exercise_task_submission_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  rejected_exercise_task_submission_id UUID NOT NULL REFERENCES rejected_exercise_task_submissions,
  file_upload_id UUID NOT NULL REFERENCES file_uploads,
  order_number INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON rejected_exercise_task_submission_files FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_rejected_exercise_task_submission_files_submission ON rejected_exercise_task_submission_files (rejected_exercise_task_submission_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE rejected_exercise_task_submission_files IS 'The files a rejected file answer named. Deliberately not consulted by the exercise_answer_uploads reaper: a rejected submission is one the student still has to redo, so its uploads stay orphaned and the objects are deleted at the end of the retention window. What survives is the audit trail -- these rows plus the file_uploads and exercise_answer_uploads rows they point at, which are only ever soft-deleted, so a rejection can still be diagnosed down to the name, type and size of every file it named.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.rejected_exercise_task_submission_id IS 'The rejected task submission that named these files.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.file_upload_id IS 'The uploaded file. The stored object is usually gone by the time anyone reads this row.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.order_number IS 'The order the client sent the files in, preserved because it is part of a file answer.';
