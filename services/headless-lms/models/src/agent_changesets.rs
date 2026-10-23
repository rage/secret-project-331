//! Agent changesets: one user's unpublished agent changes in one course.

use chrono::Duration;
use utoipa::ToSchema;

use crate::prelude::*;

/// How long an open changeset lives after its last write.
pub const LIFETIME_AFTER_LAST_WRITE_DAYS: i64 = 14;

/// How early before expiry results and the review page start warning about it.
pub const EXPIRY_WARNING_DAYS: i64 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, ToSchema)]
#[sqlx(type_name = "agent_changeset_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AgentChangesetStatus {
    Open,
    Published,
    Discarded,
    Expired,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct AgentChangeset {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub status: AgentChangesetStatus,
    pub expires_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    pub published_by: Option<Uuid>,
}

impl AgentChangeset {
    pub fn is_open(&self) -> bool {
        self.status == AgentChangesetStatus::Open
    }

    /// Whether an open changeset is close enough to expiry that its owner should be warned.
    pub fn is_expiring_soon(&self, now: DateTime<Utc>) -> bool {
        self.is_open() && self.expires_at - now <= Duration::days(EXPIRY_WARNING_DAYS)
    }
}

/// Marks a history row as written by an agent publish: shown as "via `client_name`".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentAttribution {
    pub client_name: String,
    pub changeset_id: Uuid,
}

/// The user's open changeset for the course, created if there is none.
pub async fn get_or_create_open(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<AgentChangeset> {
    sqlx::query!(
        r#"
INSERT INTO agent_changesets (user_id, course_id, expires_at)
VALUES ($1, $2, now() + make_interval(days => $3))
ON CONFLICT (user_id, course_id)
WHERE status = 'open'
  AND deleted_at IS NULL DO NOTHING
        "#,
        user_id,
        course_id,
        LIFETIME_AFTER_LAST_WRITE_DAYS as i32,
    )
    .execute(&mut *conn)
    .await?;
    get_open(conn, user_id, course_id)
        .await?
        .ok_or_else(|| model_err!(Generic, "Open agent changeset vanished".to_string()))
}

pub async fn get_open(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Option<AgentChangeset>> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
SELECT id,
  created_at,
  updated_at,
  user_id,
  course_id,
  status AS "status: AgentChangesetStatus",
  expires_at,
  published_at,
  published_by
FROM agent_changesets
WHERE user_id = $1
  AND course_id = $2
  AND status = 'open'
  AND deleted_at IS NULL
        "#,
        user_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_by_id(conn: &mut PgConnection, id: Uuid) -> ModelResult<AgentChangeset> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
SELECT id,
  created_at,
  updated_at,
  user_id,
  course_id,
  status AS "status: AgentChangesetStatus",
  expires_at,
  published_at,
  published_by
FROM agent_changesets
WHERE id = $1
  AND deleted_at IS NULL
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Like [`get_by_id`], locking the row until the transaction ends so that publishing, discarding,
/// staging and expiry of one changeset never interleave.
pub async fn get_by_id_for_update(
    conn: &mut PgConnection,
    id: Uuid,
) -> ModelResult<AgentChangeset> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
SELECT id,
  created_at,
  updated_at,
  user_id,
  course_id,
  status AS "status: AgentChangesetStatus",
  expires_at,
  published_at,
  published_by
FROM agent_changesets
WHERE id = $1
  AND deleted_at IS NULL
FOR UPDATE
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The user's changesets, newest first; all courses when `course_id` is `None`.
pub async fn get_by_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Option<Uuid>,
) -> ModelResult<Vec<AgentChangeset>> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
SELECT id,
  created_at,
  updated_at,
  user_id,
  course_id,
  status AS "status: AgentChangesetStatus",
  expires_at,
  published_at,
  published_by
FROM agent_changesets
WHERE user_id = $1
  AND (
    $2::uuid IS NULL
    OR course_id = $2
  )
  AND deleted_at IS NULL
ORDER BY created_at DESC,
  id
        "#,
        user_id,
        course_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// Pushes the expiry of an open changeset to [`LIFETIME_AFTER_LAST_WRITE_DAYS`] from now.
pub async fn extend_expiry(conn: &mut PgConnection, id: Uuid) -> ModelResult<()> {
    sqlx::query!(
        r#"
UPDATE agent_changesets
SET expires_at = now() + make_interval(days => $2)
WHERE id = $1
  AND status = 'open'
  AND deleted_at IS NULL
        "#,
        id,
        LIFETIME_AFTER_LAST_WRITE_DAYS as i32,
    )
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn mark_published(
    conn: &mut PgConnection,
    id: Uuid,
    publisher_user_id: Uuid,
) -> ModelResult<AgentChangeset> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
UPDATE agent_changesets
SET status = 'published',
  published_at = now(),
  published_by = $2
WHERE id = $1
  AND status = 'open'
  AND deleted_at IS NULL
RETURNING id,
  created_at,
  updated_at,
  user_id,
  course_id,
  status AS "status: AgentChangesetStatus",
  expires_at,
  published_at,
  published_by
        "#,
        id,
        publisher_user_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Drops an open changeset's staged changes. Errors with `RecordNotFound` if it is not open.
pub async fn discard(conn: &mut PgConnection, id: Uuid) -> ModelResult<AgentChangeset> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
UPDATE agent_changesets
SET status = 'discarded'
WHERE id = $1
  AND status = 'open'
  AND deleted_at IS NULL
RETURNING id,
  created_at,
  updated_at,
  user_id,
  course_id,
  status AS "status: AgentChangesetStatus",
  expires_at,
  published_at,
  published_by
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Expires every open changeset past its `expires_at` and returns them.
pub async fn expire_overdue(conn: &mut PgConnection) -> ModelResult<Vec<AgentChangeset>> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
UPDATE agent_changesets
SET status = 'expired'
WHERE status = 'open'
  AND expires_at <= now()
  AND deleted_at IS NULL
RETURNING id,
  created_at,
  updated_at,
  user_id,
  course_id,
  status AS "status: AgentChangesetStatus",
  expires_at,
  published_at,
  published_by
        "#,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}
