use crate::prelude::*;

/// Records that the given user has acknowledged the AI-usage / academic-integrity notice for the
/// course language group the given course belongs to. Acknowledgement is stored per course language
/// group, so accepting the notice on one language version covers all language versions. Idempotent:
/// a second call for the same (user, course language group) does nothing.
pub async fn acknowledge(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<()> {
    sqlx::query!(
        "
INSERT INTO user_ai_usage_notice_acknowledgements (user_id, course_language_group_id)
SELECT $1, course_language_group_id
FROM courses
WHERE id = $2
ON CONFLICT (user_id, course_language_group_id) WHERE deleted_at IS NULL DO NOTHING
        ",
        user_id,
        course_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Whether the given user has acknowledged the AI-usage notice for the course language group the
/// given course belongs to (any language version of the course counts).
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
      AND course_language_group_id = (
        SELECT course_language_group_id
        FROM courses
        WHERE id = $2
      )
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
