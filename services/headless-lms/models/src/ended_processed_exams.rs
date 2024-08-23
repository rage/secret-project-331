use crate::prelude::*;

/// Creates a record for the given `exam_id` or makes sure that it is undeleted.
pub async fn upsert(conn: &mut PgConnection, exam_id: Uuid) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO ended_processed_exams(exam_id)
VALUES ($1) ON CONFLICT (exam_id) DO
UPDATE
SET deleted_at = NULL
RETURNING exam_id
        ",
        exam_id
    )
    .map(|x| x.exam_id)
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Get ids for automatically graded exams that have ended but haven't yet been added to the table for processed ones.
pub async fn get_unprocessed_ended_exams_by_timestamp(
    conn: &mut PgConnection,
    timestamp: DateTime<Utc>,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT exams.id
FROM exams
  LEFT JOIN ended_processed_exams ON (ended_processed_exams.exam_id = exams.id)
WHERE exams.ends_at <= $1
  AND exams.grade_manually IS false
  AND ended_processed_exams.created_at IS NULL
  AND exams.deleted_at IS NULL
  AND ended_processed_exams.deleted_at IS NULL
        ",
        timestamp,
    )
    .map(|x| x.id)
    .fetch_all(conn)
    .await?;
    Ok(res)
}
