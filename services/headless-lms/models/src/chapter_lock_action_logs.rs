use crate::prelude::*;
use crate::user_chapter_locking_statuses::ChapterLockingStatus;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, sqlx::FromRow, ToSchema)]
pub struct ChapterLockActionLog {
    pub id: Uuid,
    pub actor_user_id: Option<Uuid>,
    pub target_user_id: Uuid,
    pub course_id: Uuid,
    pub chapter_id: Uuid,
    pub status: ChapterLockingStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    conn: &mut PgConnection,
    actor_user_id: Option<Uuid>,
    target_user_id: Uuid,
    course_id: Uuid,
    chapter_id: Uuid,
    status: ChapterLockingStatus,
) -> ModelResult<ChapterLockActionLog> {
    let row = sqlx::query_as!(
        ChapterLockActionLog,
        r#"
INSERT INTO chapter_lock_action_logs (
    actor_user_id,
    target_user_id,
    course_id,
    chapter_id,
    status
)
VALUES ($1, $2, $3, $4, $5)
RETURNING id,
  actor_user_id,
  target_user_id,
  course_id,
  chapter_id,
  status,
  created_at,
  updated_at,
  deleted_at
        "#,
        actor_user_id,
        target_user_id,
        course_id,
        chapter_id,
        status as ChapterLockingStatus,
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}
