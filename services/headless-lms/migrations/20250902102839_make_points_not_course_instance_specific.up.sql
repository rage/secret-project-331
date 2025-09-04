CREATE TEMP TABLE migration_params (batch_size int) ON COMMIT DROP;
INSERT INTO migration_params
VALUES (10000);

-- =================
-- 0) Safety copies
-- =================
CREATE TABLE user_exercise_states_copy (
  LIKE user_exercise_states INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED
);

DO $$
DECLARE last_ctid tid := '(0,0)';
did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH chunk AS (
  SELECT ctid
  FROM user_exercise_states
  WHERE ctid > last_ctid
  ORDER BY ctid
  LIMIT _b
)
INSERT INTO user_exercise_states_copy
SELECT u.*
FROM user_exercise_states u
  JOIN chunk c ON c.ctid = u.ctid;

    GET DIAGNOSTICS did_rows = ROW_COUNT;

EXIT
WHEN did_rows = 0;

SELECT max(ctid) INTO last_ctid
FROM (
    SELECT ctid
    FROM user_exercise_states
    WHERE ctid > last_ctid
    ORDER BY ctid
    LIMIT _b
  ) s;
END LOOP;
END $$;

-- user_exercise_slide_states -> _copy
CREATE TABLE user_exercise_slide_states_copy (
  LIKE user_exercise_slide_states INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED
);

DO $$
DECLARE last_ctid tid := '(0,0)';
did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH chunk AS (
  SELECT ctid
  FROM user_exercise_slide_states
  WHERE ctid > last_ctid
  ORDER BY ctid
  LIMIT _b
)
INSERT INTO user_exercise_slide_states_copy
SELECT u.*
FROM user_exercise_slide_states u
  JOIN chunk c ON c.ctid = u.ctid;

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;

SELECT max(ctid) INTO last_ctid
FROM (
    SELECT ctid
    FROM user_exercise_slide_states
    WHERE ctid > last_ctid
    ORDER BY ctid
    LIMIT _b
  ) s;
END LOOP;
END $$;

-- user_exercise_task_states -> _copy
CREATE TABLE user_exercise_task_states_copy (
  LIKE user_exercise_task_states INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED
);

DO $$
DECLARE last_ctid tid := '(0,0)';
did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH chunk AS (
  SELECT ctid
  FROM user_exercise_task_states
  WHERE ctid > last_ctid
  ORDER BY ctid
  LIMIT _b
)
INSERT INTO user_exercise_task_states_copy
SELECT u.*
FROM user_exercise_task_states u
  JOIN chunk c ON c.ctid = u.ctid;

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;

SELECT max(ctid) INTO last_ctid
FROM (
    SELECT ctid
    FROM user_exercise_task_states
    WHERE ctid > last_ctid
    ORDER BY ctid
    LIMIT _b
  ) s;
END LOOP;
END $$;

-- =====================================================================
-- 1) user_exercise_states: add course_id, backfill, soft-delete, constraint
-- =====================================================================
ALTER TABLE user_exercise_states
ADD COLUMN course_id uuid REFERENCES courses(id);

-- Backfill course_id
DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT u.ctid
  FROM user_exercise_states u
  WHERE u.course_id IS NULL
    AND u.exam_id IS NULL
  ORDER BY u.ctid
  LIMIT _b
)
UPDATE user_exercise_states ues
SET course_id = ci.course_id
FROM course_instances ci
WHERE ues.ctid IN (
    SELECT ctid
    FROM todo
  )
  AND ues.course_instance_id = ci.id;

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

-- Replace CHECK (NOT VALID → VALIDATE)
ALTER TABLE user_exercise_states DROP CONSTRAINT course_instance_or_exam_id_set;
ALTER TABLE user_exercise_states
ADD CONSTRAINT course_id_or_exam_id_set CHECK ((course_id IS NULL) <> (exam_id IS NULL)) NOT VALID;

-- Soft-delete non-active UES
DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT ues.ctid
  FROM user_exercise_states ues
    JOIN user_course_settings ucs ON ucs.user_id = ues.user_id
  WHERE ues.deleted_at IS NULL
    AND ues.course_instance_id <> ucs.current_course_instance_id
  ORDER BY ues.ctid
  LIMIT _b
)
UPDATE user_exercise_states ues
SET deleted_at = NOW()
WHERE ues.ctid IN (
    SELECT ctid
    FROM todo
  );

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

-- Propagate soft-deletes to slide/task states
DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT s.ctid
  FROM user_exercise_slide_states s
    JOIN user_exercise_states u ON u.id = s.user_exercise_state_id
  WHERE s.deleted_at IS NULL
    AND u.deleted_at IS NOT NULL
  ORDER BY s.ctid
  LIMIT _b
)
UPDATE user_exercise_slide_states s
SET deleted_at = NOW()
WHERE s.ctid IN (
    SELECT ctid
    FROM todo
  );

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT t.ctid
  FROM user_exercise_task_states t
    JOIN user_exercise_slide_states s ON s.id = t.user_exercise_slide_state_id
  WHERE t.deleted_at IS NULL
    AND s.deleted_at IS NOT NULL
  ORDER BY t.ctid
  LIMIT _b
)
UPDATE user_exercise_task_states t
SET deleted_at = NOW()
WHERE t.ctid IN (
    SELECT ctid
    FROM todo
  );

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

ALTER TABLE user_exercise_states VALIDATE CONSTRAINT course_id_or_exam_id_set;
ALTER TABLE user_exercise_states DROP COLUMN course_instance_id;

-- =====================================================================
-- 2) offered_answers_to_peer_review_temporary
-- =====================================================================
ALTER TABLE offered_answers_to_peer_review_temporary
ADD COLUMN course_id uuid REFERENCES courses(id);

DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT t.ctid
  FROM offered_answers_to_peer_review_temporary t
  WHERE t.course_id IS NULL
  ORDER BY t.ctid
  LIMIT _b
)
UPDATE offered_answers_to_peer_review_temporary t
SET course_id = ci.course_id
FROM course_instances ci
WHERE t.ctid IN (
    SELECT ctid
    FROM todo
  )
  AND t.course_instance_id = ci.id;

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

ALTER TABLE offered_answers_to_peer_review_temporary
ALTER COLUMN course_id
SET NOT NULL;
ALTER TABLE offered_answers_to_peer_review_temporary DROP COLUMN course_instance_id;
ALTER TABLE offered_answers_to_peer_review_temporary
ADD CONSTRAINT offered_answers_to_peer_review_temporary_user_exercise_unique UNIQUE (user_id, exercise_id);

-- =====================================================================
-- 3) course_module_completions
-- =====================================================================
-- Create backup table for course_module_completions
CREATE TABLE course_module_completions_backup (
  LIKE course_module_completions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING GENERATED
);

-- Copy all data to backup (batched)
DO $$
DECLARE last_ctid tid := '(0,0)';
did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH chunk AS (
  SELECT ctid
  FROM course_module_completions
  WHERE ctid > last_ctid
  ORDER BY ctid
  LIMIT _b
)
INSERT INTO course_module_completions_backup
SELECT c.*
FROM course_module_completions c
  JOIN chunk ch ON ch.ctid = c.ctid;

    GET DIAGNOSTICS did_rows = ROW_COUNT;

EXIT
WHEN did_rows = 0;

SELECT max(ctid) INTO last_ctid
FROM (
    SELECT ctid
    FROM course_module_completions
    WHERE ctid > last_ctid
    ORDER BY ctid
    LIMIT _b
  ) s;
END LOOP;
END $$;

-- Identify and soft-delete duplicate records in batches
-- Priority: 1) Has study registry registration, 2) Most recent created_at
DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH duplicates AS (
  SELECT cmc.id,
    cmc.course_module_id,
    cmc.course_id,
    cmc.user_id,
    cmc.completion_granter_user_id,
    ROW_NUMBER() OVER (
      PARTITION BY cmc.course_module_id,
      cmc.course_id,
      cmc.user_id,
      cmc.completion_granter_user_id
      ORDER BY (cmcr.id IS NOT NULL) DESC,
        cmc.created_at DESC
    ) AS rn
  FROM course_module_completions cmc
    LEFT JOIN course_module_completion_registered_to_study_registries cmcr ON cmc.id = cmcr.course_module_completion_id
    AND cmcr.deleted_at IS NULL
  WHERE cmc.deleted_at IS NULL
),
to_delete AS (
  SELECT id
  FROM duplicates
  WHERE rn > 1
  LIMIT _b
)
UPDATE course_module_completions
SET deleted_at = NOW()
WHERE id IN (
    SELECT id
    FROM to_delete
  );

    GET DIAGNOSTICS did_rows = ROW_COUNT;

EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

ALTER TABLE course_module_completions DROP COLUMN course_instance_id;

CREATE UNIQUE INDEX course_module_automatic_completion_uniqueness ON course_module_completions (course_module_id, course_id, user_id)
WHERE completion_granter_user_id IS NULL
  AND deleted_at IS NULL;

-- =====================================================================
-- 4) peer_or_self_review_submissions
-- =====================================================================
ALTER TABLE peer_or_self_review_submissions
ADD COLUMN course_id uuid REFERENCES courses(id);

DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT p.ctid
  FROM peer_or_self_review_submissions p
  WHERE p.course_id IS NULL
  ORDER BY p.ctid
  LIMIT _b
)
UPDATE peer_or_self_review_submissions p
SET course_id = ci.course_id
FROM course_instances ci
WHERE p.ctid IN (
    SELECT ctid
    FROM todo
  )
  AND p.course_instance_id = ci.id;

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

ALTER TABLE peer_or_self_review_submissions
ALTER COLUMN course_id
SET NOT NULL;
ALTER TABLE peer_or_self_review_submissions DROP COLUMN course_instance_id;

-- =====================================================================
-- 5) peer_review_queue_entries
-- =====================================================================
ALTER TABLE peer_review_queue_entries
ADD COLUMN course_id uuid REFERENCES courses(id);

DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT q.ctid
  FROM peer_review_queue_entries q
  WHERE q.course_id IS NULL
  ORDER BY q.ctid
  LIMIT _b
)
UPDATE peer_review_queue_entries q
SET course_id = ci.course_id
FROM course_instances ci
WHERE q.ctid IN (
    SELECT ctid
    FROM todo
  )
  AND q.course_instance_id = ci.id;

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

ALTER TABLE peer_review_queue_entries
ALTER COLUMN course_id
SET NOT NULL;

-- Handle duplicates before dropping course_instance_id and adding unique constraint
-- The UNIQUE NULLS NOT DISTINCT constraint treats NULL and non-NULL deleted_at as the same
-- Priority: 1) Has received reviews, 2) Most recent created_at
DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH duplicates AS (
  SELECT q.id,
    ROW_NUMBER() OVER (
      PARTITION BY q.user_id,
      q.exercise_id,
      q.course_id
      ORDER BY q.received_enough_peer_reviews DESC,
        q.created_at DESC
    ) AS rn
  FROM peer_review_queue_entries q
),
to_delete AS (
  SELECT id,
    NOW() + (
      row_number() OVER (
        ORDER BY id
      )
    ) * INTERVAL '1 microsecond' AS unique_deleted_at
  FROM duplicates
  WHERE rn > 1
  LIMIT _b
)
UPDATE peer_review_queue_entries
SET deleted_at = td.unique_deleted_at
FROM to_delete td
WHERE peer_review_queue_entries.id = td.id
  AND peer_review_queue_entries.deleted_at IS NULL;

    GET DIAGNOSTICS did_rows = ROW_COUNT;

EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

ALTER TABLE peer_review_queue_entries DROP COLUMN course_instance_id;
ALTER TABLE peer_review_queue_entries
ADD CONSTRAINT peer_review_queue_entries_unique_user_exercise_course UNIQUE NULLS NOT DISTINCT (user_id, exercise_id, course_id, deleted_at);

-- =====================================================================
-- 6) exercise_slide_submissions
-- =====================================================================
ALTER TABLE exercise_slide_submissions DROP COLUMN course_instance_id;

-- =====================================================================
-- 7) user_course_instance_exercise_service_variables → user_course_exercise_service_variables
-- =====================================================================
ALTER TABLE user_course_instance_exercise_service_variables
  RENAME TO user_course_exercise_service_variables;

ALTER TABLE user_course_exercise_service_variables
ADD COLUMN course_id uuid REFERENCES courses(id);

DO $$
DECLARE did_rows int;
_b int;
BEGIN
SELECT batch_size INTO _b
FROM migration_params;
LOOP WITH todo AS (
  SELECT u.ctid
  FROM user_course_exercise_service_variables u
  WHERE u.course_id IS NULL
  ORDER BY u.ctid
  LIMIT _b
)
UPDATE user_course_exercise_service_variables u
SET course_id = ci.course_id
FROM course_instances ci
WHERE u.ctid IN (
    SELECT ctid
    FROM todo
  )
  AND u.course_instance_id = ci.id;

    GET DIAGNOSTICS did_rows = ROW_COUNT;
EXIT
WHEN did_rows = 0;
END LOOP;
END $$;

ALTER TABLE user_course_exercise_service_variables DROP COLUMN course_instance_id;
ALTER TABLE user_course_exercise_service_variables
ALTER COLUMN course_id
SET NOT NULL;
