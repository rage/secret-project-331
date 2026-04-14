use crate::prelude::*;
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, Copy, sqlx::Type, ToSchema)]
#[sqlx(type_name = "chapter_lock_action_type", rename_all = "kebab-case")]
pub enum ChapterLockActionType {
    TeacherLock,
    TeacherUnlock,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, sqlx::FromRow, ToSchema)]
pub struct ChapterLockActionLog {
    pub id: Uuid,
    pub actor_user_id: Option<Uuid>,
    pub target_user_id: Uuid,
    pub course_id: Uuid,
    pub chapter_id: Uuid,
    pub action: ChapterLockActionType,
    pub reason: Option<String>,
    pub source: Option<String>,
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
    action: ChapterLockActionType,
    reason: Option<String>,
    source: Option<String>,
) -> ModelResult<ChapterLockActionLog> {
    let row = sqlx::query_as!(
        ChapterLockActionLog,
        r#"
INSERT INTO chapter_lock_action_logs (
    actor_user_id,
    target_user_id,
    course_id,
    chapter_id,
    action,
    reason,
    source
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id,
  actor_user_id,
  target_user_id,
  course_id,
  chapter_id,
  action as "action: ChapterLockActionType",
  reason,
  source,
  created_at,
  updated_at,
  deleted_at
        "#,
        actor_user_id,
        target_user_id,
        course_id,
        chapter_id,
        action as ChapterLockActionType,
        reason,
        source
    )
    .fetch_one(conn)
    .await?;
    Ok(row)
}
