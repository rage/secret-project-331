//! The log of changes made with the language-version repair tool. There is no undo; the log lets
//! a mistake be repaired by hand.

use crate::prelude::*;

/// What a logged change did.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "language_version_operation", rename_all = "snake_case")]
pub enum LanguageVersionOperation {
    Join,
    Split,
    LinkPages,
    UnlinkPages,
    LinkExercises,
    UnlinkExercises,
    RemoveLeftoverLinks,
    CreateCounterpart,
}

/// Logs a change. Call it in the transaction that makes the change.
///
/// `payload` should hold what is needed to reverse the change by hand: previous language group
/// ids and full copies of deleted or merged rows.
pub async fn insert(
    conn: &mut PgConnection,
    actor_user_id: Uuid,
    operation: LanguageVersionOperation,
    course_language_group_id: Uuid,
    payload: serde_json::Value,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO language_version_operation_logs (
    actor_user_id,
    operation,
    course_language_group_id,
    payload
  )
VALUES ($1, $2, $3, $4)
RETURNING id
        "#,
        actor_user_id,
        operation as LanguageVersionOperation,
        course_language_group_id,
        payload
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}
