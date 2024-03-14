use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CourseLanguageVersion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

pub async fn insert(conn: &mut PgConnection, pkey_policy: PKeyPolicy<Uuid>) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_language_groups (id)
VALUES ($1)
RETURNING id
        ",
        pkey_policy.into_uuid(),
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}
