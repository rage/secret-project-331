use crate::prelude::*;

/// Records that the given user has acknowledged the AI-usage / academic-integrity notice for the
/// given course. Idempotent: a second call for the same (user, course) does nothing.
pub async fn acknowledge(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO user_ai_usage_notice_acknowledgements (user_id, course_id)
VALUES ($1, $2)
ON CONFLICT (user_id, course_id) WHERE deleted_at IS NULL DO NOTHING
        ",
        user_id,
        course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Whether the given user has acknowledged the AI-usage notice for the given course.
pub async fn has_acknowledged(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<bool> {
    let acknowledged = sqlx::query_scalar!(
        r#"
SELECT EXISTS(
    SELECT 1
    FROM user_ai_usage_notice_acknowledgements
    WHERE user_id = $1
      AND course_id = $2
      AND deleted_at IS NULL
) AS "exists!"
        "#,
        user_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(acknowledged)
}
