//! A snapshot of a chapter after every save.

use crate::{
    agent_changesets::AgentAttribution,
    library::{
        entity_history::{EntityHistoryChangeReason, EntityHistoryEntry},
        entity_snapshots::ChapterSnapshot,
    },
    prelude::*,
};

pub async fn insert(
    conn: &mut PgConnection,
    snapshot: &ChapterSnapshot,
    change_reason: EntityHistoryChangeReason,
    author_user_id: Uuid,
    restored_from_id: Option<Uuid>,
    attribution: Option<&AgentAttribution>,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        r#"
INSERT INTO chapter_history (
    chapter_id,
    course_id,
    snapshot,
    change_reason,
    restored_from_id,
    author_user_id,
    agent_client_name,
    agent_changeset_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
        "#,
        snapshot.id,
        snapshot.course_id,
        serde_json::to_value(snapshot)?,
        change_reason as EntityHistoryChangeReason,
        restored_from_id,
        author_user_id,
        attribution.map(|a| a.client_name.as_str()),
        attribution.map(|a| a.changeset_id),
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Records the chapter's current state as saved, unless it is unchanged since its latest history
/// row. Does nothing for a deleted or missing chapter.
pub async fn insert_current(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    author_user_id: Uuid,
    attribution: Option<&AgentAttribution>,
) -> ModelResult<Option<Uuid>> {
    let Some(snapshot) =
        crate::library::entity_snapshots::load_chapter(&mut *conn, chapter_id).await?
    else {
        return Ok(None);
    };
    let latest = sqlx::query_scalar!(
        r#"
SELECT snapshot
FROM chapter_history
WHERE chapter_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id DESC
LIMIT 1
        "#,
        chapter_id,
    )
    .fetch_optional(&mut *conn)
    .await?;
    if latest.is_some_and(|latest| serde_json::from_value(latest).ok() == Some(snapshot.clone())) {
        return Ok(None);
    }
    let id = insert(
        conn,
        &snapshot,
        EntityHistoryChangeReason::Saved,
        author_user_id,
        None,
        attribution,
    )
    .await?;
    Ok(Some(id))
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<EntityHistoryEntry> {
    let res = sqlx::query_as!(
        EntityHistoryEntry,
        r#"
SELECT id,
  created_at,
  chapter_id AS entity_id,
  course_id,
  snapshot,
  change_reason AS "change_reason: EntityHistoryChangeReason",
  restored_from_id,
  author_user_id,
  agent_client_name,
  agent_changeset_id
FROM chapter_history
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The chapter's history, newest first.
pub async fn get_by_chapter_id(
    conn: &mut PgConnection,
    chapter_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<EntityHistoryEntry>> {
    let res = sqlx::query_as!(
        EntityHistoryEntry,
        r#"
SELECT id,
  created_at,
  chapter_id AS entity_id,
  course_id,
  snapshot,
  change_reason AS "change_reason: EntityHistoryChangeReason",
  restored_from_id,
  author_user_id,
  agent_client_name,
  agent_changeset_id
FROM chapter_history
WHERE chapter_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id
LIMIT $2 OFFSET $3
        "#,
        chapter_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// History of every chapter of the course, newest first.
pub async fn get_by_course_id(
    conn: &mut PgConnection,
    course_id: Uuid,
    pagination: Pagination,
) -> ModelResult<Vec<EntityHistoryEntry>> {
    let res = sqlx::query_as!(
        EntityHistoryEntry,
        r#"
SELECT id,
  created_at,
  chapter_id AS entity_id,
  course_id,
  snapshot,
  change_reason AS "change_reason: EntityHistoryChangeReason",
  restored_from_id,
  author_user_id,
  agent_client_name,
  agent_changeset_id
FROM chapter_history
WHERE course_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id
LIMIT $2 OFFSET $3
        "#,
        course_id,
        pagination.limit(),
        pagination.offset(),
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
