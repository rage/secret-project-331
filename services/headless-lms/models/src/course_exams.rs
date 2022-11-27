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

/// Gets all course ids associated with the given exam id.
pub async fn get_course_ids_by_exam_id(
    conn: &mut PgConnection,
    exam_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT course_id
FROM course_exams
WHERE exam_id = $1
  AND deleted_at IS NULL
        ",
        exam_id,
    )
    .map(|x| x.course_id)
    .fetch_all(conn)
    .await?;
    Ok(res)
}

pub async fn get_exam_ids_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query!(
        "
SELECT exam_id
FROM course_exams
WHERE exam_id = $1
  AND deleted_at IS NULL
        ",
        course_id,
    )
    .map(|x| x.exam_id)
    .fetch_all(conn)
    .await?;
    Ok(res)
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
