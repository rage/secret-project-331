use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct PageLanguageGroup {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub course_language_group_id: Uuid,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    course_language_group_id: Uuid,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO page_language_groups (
  id,
  course_language_group_id
  )
VALUES ($1, $2)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        course_language_group_id
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
