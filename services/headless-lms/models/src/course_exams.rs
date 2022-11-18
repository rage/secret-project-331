use crate::prelude::*;

pub async fn upsert(conn: &mut PgConnection, exam_id: Uuid, course_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO course_exams (course_id, exam_id)
VALUES ($1, $2) ON CONFLICT (course_id, exam_id) DO
UPDATE
SET deleted_at = NULL;
",
        course_id,
        exam_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn delete(conn: &mut PgConnection, exam_id: Uuid, course_id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        "
UPDATE course_exams
SET deleted_at = now()
WHERE course_id = $1
  AND exam_id = $2
        ",
        course_id,
        exam_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}
