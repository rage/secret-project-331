use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct CourseLanguageVersion {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub slug: String,
}

pub async fn insert(
    conn: &mut PgConnection,
    pkey_policy: PKeyPolicy<Uuid>,
    slug: &str,
) -> ModelResult<Uuid> {
    let res = sqlx::query!(
        "
INSERT INTO course_language_groups (id, slug)
VALUES ($1, $2)
RETURNING id
        ",
        pkey_policy.into_uuid(),
        slug,
    )
    .fetch_one(conn)
    .await?;
    Ok(res.id)
}

/// Returns the slug for a course language group, or None if not found or deleted.
pub async fn get_slug_by_id(
    conn: &mut PgConnection,
    course_language_group_id: Uuid,
) -> ModelResult<Option<String>> {
    let row = sqlx::query_scalar!(
        "
SELECT slug
FROM course_language_groups
WHERE id = $1
  AND deleted_at IS NULL",
        course_language_group_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(row)
}
