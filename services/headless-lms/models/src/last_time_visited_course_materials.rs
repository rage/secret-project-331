use crate::prelude::*;

pub async fn upsert_last_time_visited_course_materials(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Uuid,
) -> ModelResult<()> {
    let _res = sqlx::query!(
        r#"
INSERT INTO last_time_visited_course_materials (course_id, user_id, visit_time)
VALUES ($1, $2, now()) ON CONFLICT (course_id, user_id, deleted_at) DO
UPDATE
SET visit_time = now(),
  deleted_at = NULL
    "#,
        course_id,
        user_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn get_last_time_visited_course_materials(
    conn: &mut PgConnection,
    course_id: Uuid,
    user_id: Uuid,
) -> ModelResult<Option<DateTime<Utc>>> {
    let res = sqlx::query!(
        r#"
SELECT visit_time
FROM last_time_visited_course_materials
WHERE course_id = $1
  AND user_id = $2
  AND deleted_at IS NULL
    "#,
        course_id,
        user_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res.map(|r| r.visit_time))
}
