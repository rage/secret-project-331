//! Agent changesets: one user's unpublished agent changes in one course.

use chrono::Duration;
use utoipa::ToSchema;

use crate::prelude::*;

/// How long an open changeset lives after its last write.
const LIFETIME_AFTER_LAST_WRITE_DAYS: i64 = 14;

/// How early before expiry results and the review page start warning about it.
const EXPIRY_WARNING_DAYS: i64 = 3;

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
    /// The only user who can publish or discard the changeset.
    pub user_id: Uuid,
    pub course_id: Uuid,
    /// The status now: `Expired` for an open changeset past `expires_at`, which the table records
    /// only at the next write to the course.
    pub status: AgentChangesetStatus,
    pub expires_at: DateTime<Utc>,
    pub published_at: Option<DateTime<Utc>>,
    /// Incremented by every change to the staged entities; see [`increment_revision`].
    pub revision: i32,
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

/// The user's open changeset for the course, created if there is none.
pub async fn get_or_create_open(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<AgentChangeset> {
    // An overdue changeset still holds the one open slot of the unique index until marked.
    sqlx::query!(
        r#"
UPDATE agent_changesets
SET status = 'expired'
WHERE user_id = $1
  AND course_id = $2
  AND status = 'open'
  AND NOT agent_changeset_is_open(status, expires_at)
        "#,
        user_id,
        course_id,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        r#"
INSERT INTO agent_changesets (user_id, course_id, expires_at)
VALUES ($1, $2, now() + make_interval(days => $3))
ON CONFLICT (user_id, course_id)
WHERE status = 'open' DO NOTHING
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
SELECT *
FROM agent_changesets
WHERE user_id = $1
  AND course_id = $2
  AND agent_changeset_is_open(status, expires_at)
        "#,
        user_id,
        course_id,
    )
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

/// The user's open changeset that changes the page, if any.
pub async fn get_open_changing_page(
    conn: &mut PgConnection,
    user_id: Uuid,
    page_id: Uuid,
) -> ModelResult<Option<AgentChangeset>> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
SELECT cs.*
FROM agent_changesets cs
  JOIN agent_changeset_entities e ON e.changeset_id = cs.id
WHERE cs.user_id = $1
  AND agent_changeset_is_open(cs.status, cs.expires_at)
  AND e.entity_type = 'page'
  AND e.entity_id = $2
        "#,
        user_id,
        page_id,
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
  agent_changeset_current_status(status, expires_at) AS "status!",
  expires_at,
  published_at,
  revision
FROM agent_changesets
WHERE id = $1
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The user's changeset. Errors with `NotFound` if it is someone else's, so that callers don't
/// reveal other users' changesets.
pub async fn get_by_id_for_user(
    conn: &mut PgConnection,
    id: Uuid,
    user_id: Uuid,
) -> ModelResult<AgentChangeset> {
    let changeset = get_by_id(conn, id).await?;
    if changeset.user_id != user_id {
        return Err(model_err!(NotFound, "Changeset not found".to_string()));
    }
    Ok(changeset)
}

/// Like [`get_by_id`], locking the row until the transaction ends so that publishing, discarding
/// and staging of one changeset never interleave.
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
  agent_changeset_current_status(status, expires_at) AS "status!",
  expires_at,
  published_at,
  revision
FROM agent_changesets
WHERE id = $1
FOR UPDATE
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// The user's changesets in the course, newest first.
pub async fn get_by_user_and_course(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<Vec<AgentChangeset>> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
SELECT id,
  created_at,
  updated_at,
  user_id,
  course_id,
  agent_changeset_current_status(status, expires_at) AS "status!",
  expires_at,
  published_at,
  revision
FROM agent_changesets
WHERE user_id = $1
  AND course_id = $2
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

/// The courses the user has changesets in.
pub async fn get_course_ids_by_user(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> ModelResult<Vec<Uuid>> {
    let res = sqlx::query_scalar!(
        r#"
SELECT DISTINCT course_id
FROM agent_changesets
WHERE user_id = $1
        "#,
        user_id,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// The user's open changesets in the courses and their `closed_limit` most recent closed ones,
/// newest first.
pub async fn get_open_and_recent_by_user(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_ids: &[Uuid],
    closed_limit: i64,
) -> ModelResult<Vec<AgentChangeset>> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
SELECT id AS "id!",
  created_at AS "created_at!",
  updated_at AS "updated_at!",
  user_id AS "user_id!",
  course_id AS "course_id!",
  status AS "status!: AgentChangesetStatus",
  expires_at AS "expires_at!",
  published_at,
  revision AS "revision!"
FROM (
    (
      SELECT id,
        created_at,
        updated_at,
        user_id,
        course_id,
        agent_changeset_current_status(status, expires_at) AS status,
        expires_at,
        published_at,
        revision
      FROM agent_changesets
      WHERE user_id = $1
        AND course_id = ANY($2)
        AND agent_changeset_is_open(status, expires_at)
    )
    UNION ALL
    (
      SELECT id,
        created_at,
        updated_at,
        user_id,
        course_id,
        agent_changeset_current_status(status, expires_at) AS status,
        expires_at,
        published_at,
        revision
      FROM agent_changesets
      WHERE user_id = $1
        AND course_id = ANY($2)
        AND NOT agent_changeset_is_open(status, expires_at)
      ORDER BY created_at DESC,
        id
      LIMIT $3
    )
  ) listed
ORDER BY created_at DESC,
  id
        "#,
        user_id,
        course_ids,
        closed_limit,
    )
    .fetch_all(conn)
    .await?;
    Ok(res)
}

/// What the course management view shows of the user's changesets in a course without listing
/// them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct AgentChangesetCounts {
    /// Whether the user has any changeset in the course, open or not.
    pub has_changesets: bool,
    /// How many entities the user's open changeset stages; 0 without one.
    pub open_entity_count: i64,
}

/// The user's [`AgentChangesetCounts`] in the course.
pub async fn get_counts(
    conn: &mut PgConnection,
    user_id: Uuid,
    course_id: Uuid,
) -> ModelResult<AgentChangesetCounts> {
    let res = sqlx::query_as!(
        AgentChangesetCounts,
        r#"
SELECT EXISTS (
    SELECT 1
    FROM agent_changesets
    WHERE user_id = $1
      AND course_id = $2
  ) AS "has_changesets!",
  (
    SELECT count(*)
    FROM agent_changeset_entities e
      JOIN agent_changesets cs ON cs.id = e.changeset_id
    WHERE cs.user_id = $1
      AND cs.course_id = $2
      AND agent_changeset_is_open(cs.status, cs.expires_at)
  ) AS "open_entity_count!"
        "#,
        user_id,
        course_id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Records a write to an open changeset the caller has locked with [`get_by_id_for_update`]:
/// increments its revision and pushes its expiry to [`LIFETIME_AFTER_LAST_WRITE_DAYS`] from now.
pub async fn record_write(conn: &mut PgConnection, id: Uuid) -> ModelResult<AgentChangeset> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
UPDATE agent_changesets
SET revision = revision + 1,
  expires_at = now() + make_interval(days => $2)
WHERE id = $1
  AND agent_changeset_is_open(status, expires_at)
RETURNING *
        "#,
        id,
        LIFETIME_AFTER_LAST_WRITE_DAYS as i32,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn mark_published(conn: &mut PgConnection, id: Uuid) -> ModelResult<AgentChangeset> {
    let res = sqlx::query_as!(
        AgentChangeset,
        r#"
UPDATE agent_changesets
SET status = 'published',
  published_at = now()
WHERE id = $1
  AND agent_changeset_is_open(status, expires_at)
RETURNING *
        "#,
        id,
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
  AND agent_changeset_is_open(status, expires_at)
RETURNING *
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(res)
}

/// Increments the revision of a changeset the caller has locked with [`get_by_id_for_update`]
/// and returns the new revision.
pub async fn increment_revision(conn: &mut PgConnection, id: Uuid) -> ModelResult<i32> {
    let revision = sqlx::query_scalar!(
        r#"
UPDATE agent_changesets
SET revision = revision + 1
WHERE id = $1
RETURNING revision
        "#,
        id,
    )
    .fetch_one(conn)
    .await?;
    Ok(revision)
}
