//! A snapshot of a chapter, course module or course's settings after every save. Page history
//! lives in `page_history`.

use crate::{
    library::entity_snapshots::{self, ContentEntityType, EntityKey, EntitySnapshot},
    prelude::*,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type)]
#[sqlx(type_name = "entity_history_change_reason", rename_all = "snake_case")]
pub enum EntityHistoryChangeReason {
    Saved,
    Deleted,
    Restored,
}

/// Who made a change that history records.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HistoryAuthor {
    pub user_id: Uuid,
    /// For an agent change, the latest call that staged it before it was published; `None` for
    /// changes made in the web UI.
    pub agent_call_id: Option<Uuid>,
}

impl HistoryAuthor {
    pub fn user(user_id: Uuid) -> Self {
        Self {
            user_id,
            agent_call_id: None,
        }
    }

    pub fn agent(user_id: Uuid, call_id: Uuid) -> Self {
        Self {
            user_id,
            agent_call_id: Some(call_id),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct EntityHistoryEntry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub entity_type: ContentEntityType,
    /// The chapter or module id; the course id for course settings.
    pub entity_id: Uuid,
    /// The entity's fields after the change, in its snapshot shape.
    pub snapshot: serde_json::Value,
    pub change_reason: EntityHistoryChangeReason,
    pub restored_from_id: Option<Uuid>,
    pub author_user_id: Uuid,
    pub agent_call_id: Option<Uuid>,
}

/// Records `snapshot` as a new history row. Only chapters, modules and course settings have
/// history; the database refuses other entity types.
pub async fn insert(
    conn: &mut PgConnection,
    snapshot: &EntitySnapshot,
    change_reason: EntityHistoryChangeReason,
    author: HistoryAuthor,
    restored_from_id: Option<Uuid>,
) -> ModelResult<Uuid> {
    let id = sqlx::query_scalar!(
        r#"
INSERT INTO entity_history (
    entity_type,
    entity_id,
    course_id,
    snapshot,
    change_reason,
    restored_from_id,
    author_user_id,
    agent_call_id
  )
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id
        "#,
        snapshot.entity_type() as ContentEntityType,
        snapshot.entity_id(),
        snapshot.course_id(),
        serde_json::to_value(snapshot)?,
        change_reason as EntityHistoryChangeReason,
        restored_from_id,
        author.user_id,
        author.agent_call_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(id)
}

/// Records each snapshot as saved, except those equal to their entity's latest history row.
pub async fn record_saved(
    conn: &mut PgConnection,
    snapshots: &[EntitySnapshot],
    author: HistoryAuthor,
) -> ModelResult<()> {
    if snapshots.is_empty() {
        return Ok(());
    }
    let mut entity_types = Vec::with_capacity(snapshots.len());
    let mut entity_ids = Vec::with_capacity(snapshots.len());
    let mut course_ids = Vec::with_capacity(snapshots.len());
    let mut values = Vec::with_capacity(snapshots.len());
    for snapshot in snapshots {
        entity_types.push(snapshot.entity_type());
        entity_ids.push(snapshot.entity_id());
        course_ids.push(snapshot.course_id());
        values.push(serde_json::to_value(snapshot)?);
    }
    sqlx::query!(
        r#"
INSERT INTO entity_history (
    entity_type,
    entity_id,
    course_id,
    snapshot,
    change_reason,
    author_user_id,
    agent_call_id
  )
SELECT k.entity_type,
  k.entity_id,
  k.course_id,
  k.snapshot,
  'saved',
  $5,
  $6
FROM UNNEST(
    $1::content_entity_type [],
    $2::uuid [],
    $3::uuid [],
    $4::jsonb []
  ) AS k(entity_type, entity_id, course_id, snapshot)
WHERE (
    SELECT h.snapshot
    FROM entity_history h
    WHERE h.entity_type = k.entity_type
      AND h.entity_id = k.entity_id
    ORDER BY h.created_at DESC,
      h.id DESC
    LIMIT 1
  ) IS DISTINCT FROM k.snapshot
        "#,
        entity_types as Vec<ContentEntityType>,
        &entity_ids,
        &course_ids,
        &values,
        author.user_id,
        author.agent_call_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Runs `save` in a transaction and then records the entity's state as [`record_current`] does.
pub async fn save_recording<T>(
    conn: &mut PgConnection,
    entity_type: ContentEntityType,
    entity_id: Uuid,
    author: HistoryAuthor,
    save: impl AsyncFnOnce(&mut PgConnection) -> ModelResult<T>,
) -> ModelResult<T> {
    let mut tx = conn.begin().await?;
    let saved = save(&mut *tx).await?;
    record_current(&mut tx, entity_type, entity_id, author).await?;
    tx.commit().await?;
    Ok(saved)
}

/// Records the current state of the entities as saved, as [`record_saved`] does. Deleted and
/// missing entities are skipped.
pub async fn record_current_many(
    conn: &mut PgConnection,
    keys: &[EntityKey],
    author: HistoryAuthor,
) -> ModelResult<()> {
    let snapshots: Vec<EntitySnapshot> = entity_snapshots::load_live_many(&mut *conn, keys)
        .await?
        .into_values()
        .flatten()
        .collect();
    record_saved(conn, &snapshots, author).await
}

/// [`record_current_many`] of one entity.
pub async fn record_current(
    conn: &mut PgConnection,
    entity_type: ContentEntityType,
    entity_id: Uuid,
    author: HistoryAuthor,
) -> ModelResult<()> {
    record_current_many(conn, &[(entity_type, entity_id)], author).await
}

/// Records the entity's current state as deleted. Call it before deleting the entity; does
/// nothing if it is already gone.
pub async fn record_deleted(
    conn: &mut PgConnection,
    entity_type: ContentEntityType,
    entity_id: Uuid,
    author: HistoryAuthor,
) -> ModelResult<()> {
    if let Some(snapshot) =
        entity_snapshots::load_live(&mut *conn, (entity_type, entity_id)).await?
    {
        insert(
            conn,
            &snapshot,
            EntityHistoryChangeReason::Deleted,
            author,
            None,
        )
        .await?;
    }
    Ok(())
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<EntityHistoryEntry> {
    let res = sqlx::query_as!(
        EntityHistoryEntry,
        r#"
SELECT id,
  created_at,
  entity_type AS "entity_type: ContentEntityType",
  entity_id,
  snapshot,
  change_reason AS "change_reason: EntityHistoryChangeReason",
  restored_from_id,
  author_user_id,
  agent_call_id
FROM entity_history
WHERE id = $1
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The newest history row of an entity: who last changed it and when.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntityVersion {
    pub created_at: DateTime<Utc>,
    pub author_user_id: Uuid,
    /// The agent client the change was made through; `None` for the web UI.
    pub agent_client_name: Option<String>,
}

/// The newest `page_history` or `entity_history` row of the page, chapter, module or course
/// settings with the id, only in the course when `course_id` is given. `None` for glossary terms
/// and references, which have no history, and for entities never saved since history was
/// introduced.
pub async fn latest_version(
    conn: &mut PgConnection,
    entity_id: Uuid,
    course_id: Option<Uuid>,
) -> ModelResult<Option<EntityVersion>> {
    let version = sqlx::query_as!(
        EntityVersion,
        r#"
SELECT h.created_at AS "created_at!",
  h.author_user_id AS "author_user_id!",
  c.client_name AS "agent_client_name?"
FROM (
    SELECT ph.id,
      ph.created_at,
      ph.author_user_id,
      ph.agent_call_id
    FROM page_history ph
      JOIN pages p ON p.id = ph.page_id
    WHERE ph.page_id = $1
      AND (
        $2::uuid IS NULL
        OR p.course_id = $2
      )
      AND ph.deleted_at IS NULL
    UNION ALL
    SELECT id,
      created_at,
      author_user_id,
      agent_call_id
    FROM entity_history
    WHERE entity_id = $1
      AND (
        $2::uuid IS NULL
        OR course_id = $2
      )
  ) h
  LEFT JOIN agent_changeset_calls c ON c.id = h.agent_call_id
ORDER BY h.created_at DESC,
  h.id DESC
LIMIT 1
        "#,
        entity_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(version)
}
